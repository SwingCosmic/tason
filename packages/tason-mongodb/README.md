# tason-mongodb

MongoDB / BSON 类型扩展：`ObjectId`、`Long` → `Int64`、`Decimal128`、`Binary` 子类型等。

```bash
npm install tason tason-mongodb bson
```

`bson` 为 **peerDependencies**，请与项目里 `mongodb` / `mongoose` 解析到的 `bson` 版本对齐。

## 用法

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
registerMongoDBTypes(s.registry);
// parse 仍用核心默认（Int64 → bigint）；stringify 能认出 bson 实例

registerMongoDBTypes(s.registry, {
  replaceDefaultImplementation: { Int64: true },
});
// parse('Int64("1")') 得到绑定的 bson.Long
```

和 mongoose 一起用时，把驱动那份 class 传进去（与读库实例同一副本）：

```ts
import mongoose from "mongoose";

registerMongoDBTypes(s.registry, {
  bson: mongoose.mongo,
  replaceDefaultImplementation: { Int64: true },
});
```

| 选项 | 默认 | 作用 |
| --- | --- | --- |
| `bson` | `loadDefaultBson()`（CJS `bson`） | 写入模块持有点，TypeInfo.ctor 跟着变 |
| `replaceDefaultImplementation` | 仅追加 | `true` 或 `{ Int64: true }` 把 parse 默认换成 bson 类 |
| `include` | 全部 TypeName | 只注册列出的；未知名抛错 |

`BSONJavaScript` 需要 `allowUnsafeTypes: true`。

## bson 双实例

`bson@5+` 是 dual package：

| 加载方式 | 文件 | 谁在用 |
| --- | --- | --- |
| `require('bson')` | `bson.cjs` | `mongodb`、`mongoose`、`loadDefaultBson()` |
| ESM `import from 'bson'` | `bson.node.mjs` | 你自己的 `import { Long } from "bson"` |

两份 **不是同一个 `class`**。`Long.isLong(x)` 可能为 true，`x instanceof Long`（ESM）为 false。TASON stringify 先看 `instanceof ctor`，认不出就把 Long 写成 `{low,high}`。

本包模块加载时 **不** import bson。`registerMongoDBTypes` 才写入唯一持有点（缺省 CJS 那份）。静态 `MongoTypes` 的 `ctor` 是 getter，读的是这份引用。未注册就读 `ctor` / parse 会抛错。

业务代码取 class 用 `mongoose.mongo`、`import { Long } from "mongodb"` 或 `getBson()`，不要 `import { Long } from "bson"`。

## 类型清单

| TypeName | 文本 | 运行时 |
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

未开 `replaceDefaultImplementation` 时，追加项的 **parse** 仍是核心包装（或拆箱后的 `bigint` / `number`）；**stringify** 已能识别对应 bson 实例。

数值 Handling、驱动 `promote*` 交叉：[behavior-matrix.md](./behavior-matrix.md)。  
mongoose `lean()` vs `toObject()`、集成测试、持有点实现：[docs/tason-mongodb.md](../../docs/tason-mongodb.md)。

## License

MIT
