# tason-mongodb

**[TASON](../../README.md) 的 MongoDB / BSON 扩展包**——让 TASON 认识 MongoDB 生态里的标量值类型。它不改变 TASON 本身的语法与核心行为，只是在核心 [`TASONTypeRegistry`](../tason/src/TASONTypeRegistry.ts) 上追加一组类型实现。

## 功能简介

安装并调用一次 [`registerMongoDBTypes`](./src/register.ts) 后，TASON 即可双向处理 BSON 标量：

- **序列化（stringify）**：能识别手里的 `ObjectId`、`bson.Long`、`Decimal128`、`Binary` 等实例，写出对应的 TypeInstance 文本（如 `ObjectId("6670f391dcb0bd791cb3bd18")`），而不是退化成 `{low, high}` 这类普通对象。
- **反序列化（parse）**：默认仍按核心行为产出原生值或核心包装（`Int64("1")` → `bigint`）；需要时可通过 `replaceDefaultImplementation` 把 parse 结果换成对应的 bson 类实例。
- **Binary 子类型区分**：UUID（subtype 3/4）、MD5（5）、加密/敏感数据（6/8）、向量（9）各自映射到独立 TypeName，不会混成普通二进制。

### 类型支持表

| TypeName | 文本写法 | 运行时实现 |
| --- | --- | --- |
| `ObjectId` | `ObjectId("6670f391dcb0bd791cb3bd18")` | `bson.ObjectId` |
| `BSONMinKey` / `BSONMaxKey` | `BSONMinKey("")` | `MinKey` / `MaxKey` |
| `BSONTimestamp` | `BSONTimestamp({ t, i })` | `bson.Timestamp`（≠ 核心毫秒 `Timestamp`） |
| `BSONJavaScript` | `BSONJavaScript("源码")` | `bson.Code`；仅 unsafe；不支持 scope |
| `Int64` | `Int64("…")` | 追加 `bson.Long`（`match` 排除 `Timestamp`） |
| `Decimal128` | `Decimal128("…")` | 追加 `bson.Decimal128` |
| `Int32` | `Int32("…")` | 追加 `bson.Int32` |
| `Float64` | `Float64("…")` | 追加 `bson.Double` |
| `UUID` | `UUID("8-4-4-4-12")` | 追加 `bson.UUID`；Binary subtype 3/4 也写出 UUID |
| `Buffer` | `Buffer("base64,…")` | 追加 `Binary`（剩余 subtype，不保留用户 subtype） |
| `MD5` | `MD5("32hex")` | `Binary` subtype 5 |
| `BSONEncrypted` / `BSONSensitive` | `BSONEncrypted("base64,…")` | subtype 6 / 8 |
| `BSONVector` | `BSONVector({ dtype, values })` | subtype 9；`int8` / `float32` / `packedBit` |

表中「追加」指在核心同名 TypeName 下**追加类型实现**：序列化立刻能认出对应 bson 实例，但反序列化的默认实现不变；要换默认见下文 `replaceDefaultImplementation`。

## 安装与注册

```bash
npm install tason tason-mongodb bson
```

`bson` 为 **peerDependencies**，请与项目里 `mongodb` / `mongoose` 解析到的 `bson` 版本对齐。

### 基本注册

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
registerMongoDBTypes(s.registry);
// 反序列化仍用核心默认（Int64("1") → bigint）；序列化已能认出 bson 实例
```

### 把反序列化结果换成 bson 类

```ts
registerMongoDBTypes(s.registry, {
  replaceDefaultImplementation: { Int64: true },
});
// parse('Int64("1")') 得到绑定的 bson.Long
```

### 与 mongoose 一起用

把驱动那份 class 传进去（与读库实例同一副本）：

```ts
import mongoose from "mongoose";

registerMongoDBTypes(s.registry, {
  bson: mongoose.mongo,
  replaceDefaultImplementation: { Int64: true },
});
```

### 注册选项

| 选项 | 默认 | 作用 |
| --- | --- | --- |
| `bson` | `loadDefaultBson()`（CJS `bson`） | 写入模块持有点，TypeInfo.ctor 跟着变 |
| `replaceDefaultImplementation` | 仅追加 | `true` 或 `{ Int64: true }` 把 parse 默认换成 bson 类 |
| `include` | 全部 TypeName | 只注册列出的；未知名抛错 |

`BSONJavaScript` 需要 `allowUnsafeTypes: true`。

mongoose 的 `lean()` 与 `toObject()` 读出的数值形态不同，交给序列化前的注意事项见 [docs/tason-mongodb.md](../../docs/tason-mongodb.md)。

## bson 双实例（ESM / CJS）坑点

`bson@5+` 是 dual package，同一个包会按加载方式解析出**两份不同的代码**：

| 加载方式 | 实际文件 | 谁在用 |
| --- | --- | --- |
| `require('bson')` | `bson.cjs` | `mongodb`、`mongoose`、`loadDefaultBson()` |
| ESM `import from 'bson'` | `bson.node.mjs` | 你自己的 `import { Long } from "bson"` |

两份 **不是同一个 `class`**。后果是：

- `Long.isLong(x)` 可能为 `true`，但 `x instanceof Long`（ESM 那份）为 `false`；
- TASON 序列化先看 `instanceof ctor` 再认领实例，认不出就会把 Long 写成 `{low,high}` 普通对象。

规避方法——**业务代码不要直接从 `bson` import class**，改用以下任一来源（它们都指向 CJS 那份，与驱动一致）：

- `mongoose.mongo`
- `import { Long } from "mongodb"`
- 本包导出的 `getBson()`

实现机制上：本包模块加载时**不** import bson；`registerMongoDBTypes` 调用时才写入唯一持有点（缺省为 CJS 那份）。静态 `MongoTypes` 的 `ctor` 是 getter，读的是这份引用；未注册就读 `ctor` / 反序列化会抛错。

## 数值处理选项交叉矩阵

驱动读选项（`promoteValues` / `promoteLongs` / `useBigInt64` / `promoteBuffers`）、`replaceDefaultImplementation` 与 Number Handling 三者如何互相影响，逐值对照见 [behavior-matrix.md](./behavior-matrix.md)。

## License

MIT
