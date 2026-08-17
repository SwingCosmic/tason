# tason-mongodb

MongoDB / BSON 类型扩展（`ObjectId`；`Long` 追加类型实现到 `Int64`；Binary 子类型等）。

> `registerMongoDBTypes` / `MongoTypes` / `replaceDefaultImplementation` 可用。  
> 设计与排期见 [docs/features/monorepo/](../../docs/features/monorepo/)。  
> 类型清单与映射：[phase-c-bson-types.md](../../docs/features/monorepo/phase-c-bson-types.md)。

## 安装

```bash
npm install tason tason-mongodb bson
```

`bson` 为 **peerDependencies**，请与项目中 `mongodb` / `mongoose` 解析到的 `bson` 版本对齐，避免双份副本导致 `instanceof` 失败。

## 用法

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
// 仅追加类型实现（parse 仍用核心默认；stringify 认 BSON 实例）：
registerMongoDBTypes(s.registry);
// 将 Long / Decimal128 等设为默认实现：
// registerMongoDBTypes(s.registry, { replaceDefaultImplementation: true });
// 或：{ replaceDefaultImplementation: { Int64: true } }
// 选择性注册：{ include: ["ObjectId", "Int64"] }
```

| 选项 | 行为 |
| --- | --- |
| （缺省） | 对 `Int64` / `Decimal128` 等只 **追加类型实现**：`parse` 仍为核心包装；`stringify(new Long(…))` 可写出 `Int64("…")` |
| `replaceDefaultImplementation: true` | 上述可映射项全部改为默认实现，`parse('Int64("1")')` 得到 `bson.Long` |
| `replaceDefaultImplementation: { Int64: true }` | 按 TypeName 细开 |
| `include` | 只注册列出的 TypeName；未知名抛错 |

## 选项与行为矩阵

两层选项不要混：

1. **驱动** `bson.deserialize` / Mongo 读选项（`promoteValues` / `promoteLongs` / `useBigInt64` / `promoteBuffers`）决定手里是什么 JS 值。
2. **本包** `replaceDefaultImplementation` 决定 `parse` 用哪个实现；bson 类如何 `stringify` 由核心 [Number Handling](../../docs/number-handling.md) 决定，与 `replaceDefaultImplementation` 无关。

Handling **只认核心数值包装**（`Int64` / `Int32` / `Float64` / `Decimal128` 等）。`bson.Long` / `Int32` / `Double` / `Decimal128` 不是核心包装：默认 `unsafe-only` 也会写出 TypeName；`serializeNumberHandling: "none"` 会对这些实例 **抛错**（无法拆成裸字面量）。要 JSON 风格数字，应让驱动提升成 `number` / `bigint`，而不是对 bson 包装开 `none`。

### 驱动读出 → `stringify`

已 `registerMongoDBTypes`、Handling 为默认。`promoteValues` 默认 `true`；`promoteLongs` 默认 `true`；`useBigInt64` 默认 `false`；`promoteBuffers` 默认 `false`。

| BSON | 驱动选项 | JS 值 | `stringify` |
| --- | --- | --- | --- |
| int | `promoteValues: true` | `number` | `42` |
| int | `promoteValues: false` | `bson.Int32` | `Int32("42")` |
| double | `promoteValues: true` | `number` | `1.5` |
| double | `promoteValues: false` | `bson.Double` | `Float64("1.5")` |
| long（安全整数） | `promoteLongs: true` | `number` | `1` |
| long（安全整数） | `promoteLongs: false` | `bson.Long` | `Int64("1")` |
| long（超出安全整数） | 未开 `useBigInt64` | `bson.Long` | `Int64("…")` |
| long | `useBigInt64: true` | `bigint` | 安全 → `1`；超出 → `BigInt("…")` |
| decimal | （不提升） | `bson.Decimal128` | `Decimal128("…")` |
| objectId / timestamp / min·max | — | 对应 bson 类 | `ObjectId` / `BSONTimestamp` / `BSONMinKey` / `BSONMaxKey` |
| binData 通用 | `promoteBuffers: false` | `Binary`(0/1/2/7/128+) | `Buffer("base64,…")` |
| binData 通用 | `promoteBuffers: true` | Node `Buffer` | `Buffer("base64,…")` |
| binData UUID (3/4) | `promoteBuffers: false` | `UUID` / `Binary` | `UUID("…")` |
| binData MD5 / 加密 / 敏感 / 向量 | `promoteBuffers: false` | `Binary`(5/6/8/9) | `MD5` / `BSONEncrypted` / `BSONSensitive` / `BSONVector` |
| 上表专用 subtype | `promoteBuffers: true` | Node `Buffer` | `Buffer(...)`，**丢失 subtype** |

`useBigInt64: true` 时驱动要求同时 `promoteValues` 与 `promoteLongs` 为 true，否则 `bson` 自己抛错。

Mongoose 的 `lean()` 与 `toObject()` **不是**同一条读路径，同一库值可以变成不同 JS 类型、写出不同 TASON 文本。见下方 [与 Mongoose 一起用](#与-mongoose-一起用)。

配合 `mongoose-long`（`Schema.Types.Long`，值即 `mongoose.mongo.Long`，与本包同一份 `bson.Long`）：写入 / 非 lean 读回 / 查询条件统一 cast 为 `bson.Long`（接受 `Long` / `number` / `bigint` / 十进制字符串，经 `fromString` 精确转换），非 lean 的 Document 与 TASON `Int64` 装箱直接对应，Long 数组不必再走 `Mixed`。本包不为 mongoose-long 写专用适配——兼容其字段就是兼容 `bson.Long`。`lean()` 仍不走这层 cast，见下节。

`Schema.Types.Int32`（mongoose 8 内置，与旧插件 `mongoose-int32` 同一模式）**不**对称：cast 目标是 `number`（保证落盘 BSON int），内存不是 `bson.Int32`。默认 `promoteValues` 下 `lean()` 与 `toObject()` 都是 `number`，没有 Long 那种安全/超安全分叉。

### `parse`：`replaceDefault` × Handling

| TypeName | `replaceDefault` | `deserializeNumberHandling` | 结果 |
| --- | --- | --- | --- |
| `Int64` | 关（默认） | `native` / 默认 | `bigint` |
| `Int64` | 关 | `all` | 核心 `Int64` |
| `Int64` | 开 | **任意** | `bson.Long`（Handling **不**拆 bson 类） |
| `Int32` | 关 | `native` / 默认 | `number` |
| `Int32` | 关 | `all` | 核心 `Int32` |
| `Int32` | 开 | 任意 | `bson.Int32` |
| `Float64` | 同 `Int32` | | `number` / 核心 `Float64` / `bson.Double` |
| `Decimal128` | 关 | `native` / 默认 | `decimal.js` 的 `Decimal` |
| `Decimal128` | 关 | `all` | 核心 `Decimal128` |
| `Decimal128` | 开 | 任意 | `bson.Decimal128` |
| `UUID` / `Buffer` | 关 | — | 核心 `UUID` / `Buffer` |
| `UUID` / `Buffer` | 开 | — | `bson.UUID` / `Binary` subtype 0 |
| `ObjectId`、`MD5`、`BSON*` | — | — | 对应 bson 类（无 replaceDefault、不受 Handling） |

表中「默认」指 `object-fallback-native`：在值级路径（无 ObjectType 字段、无 schema 契约）下它与 `native` 行为相同。

单次换实现用 `parseAs(Long, 'Int64("1")')` 等，不改全局默认。

### `stringify` bson 数值类 × Handling

| 值 | `unsafe-only`（默认） | `all` | `none` |
| --- | --- | --- | --- |
| `bson.Long` / `Int32` / `Double` / `Decimal128` | 对应 TypeName（**安全整数也装箱**） | 同上 | **抛错** |
| 核心 `Int64(1)` 等包装 | 安全则裸字面量 | TypeName | 强制裸字面量 |
| 已提升的 `number` / `bigint` | 走核心 Handling | 走核心 Handling | 走核心 Handling |
| `ObjectId` / `Binary` / `UUID` 等非数值 | TypeName | TypeName | TypeName |

上表与 `replaceDefaultImplementation` 开 / 关无关：`stringify` 从实例出发识别实现（见 [类型系统 · 多实现](../../docs/type-system.md#同一-typename-的多种实现)），换默认实现不改变序列化结果。

## 已实现的 TypeName

| TypeName | 文本 | 运行时 |
| --- | --- | --- |
| `ObjectId` | `ObjectId("6670f391dcb0bd791cb3bd18")` | `bson.ObjectId` |
| `BSONMinKey` | `BSONMinKey("")` | `bson.MinKey` |
| `BSONMaxKey` | `BSONMaxKey("")` | `bson.MaxKey` |
| `BSONTimestamp` | `BSONTimestamp({ t, i })` | `bson.Timestamp`（**不是**核心毫秒 `Timestamp`） |
| `BSONJavaScript` | `BSONJavaScript("源码")` | `bson.Code`；仅 `allowUnsafeTypes` 时登记；带 scope 的 Code 不支持 |
| `Int64` | `Int64("…")` | 追加 `bson.Long`（`match` 排除 `Timestamp`） |
| `Decimal128` | `Decimal128("…")` | 追加 `bson.Decimal128` |
| `Int32` | `Int32("…")` | 追加 `bson.Int32` |
| `Float64` | `Float64("…")` | 追加 `bson.Double` |
| `UUID` | `UUID("8-4-4-4-12")` | 追加 `bson.UUID`；`Binary` subtype 3/4 写出 `UUID` |
| `Buffer` | `Buffer("base64,…")` / `hex,…` | 追加 `bson.Binary`（剩余 subtype；**不**保留用户 subtype） |
| `MD5` | `MD5("32hex")` | `bson.Binary` subtype 5 |
| `BSONEncrypted` | `BSONEncrypted("base64,…")` | `bson.Binary` subtype 6 |
| `BSONSensitive` | `BSONSensitive("base64,…")` | `bson.Binary` subtype 8 |
| `BSONVector` | `BSONVector({ dtype, values })` | `bson.Binary` subtype 9；`dtype` 为 `"int8"` / `"float32"` / `"packedBit"`（后者可带 `padding`） |

未开 `replaceDefaultImplementation` 时，上表追加项的 `parse` 仍是核心包装（或拆箱后的 `bigint` / `number` / 核心 `Buffer`）；`stringify` 已能识别对应 bson 实例。`Binary` 按 subtype 拆成上表各 TypeName，互不抢写。选型与 Handling 交叉见上一节矩阵。

## 公开导出

| 导出 | 说明 |
| --- | --- |
| `registerMongoDBTypes(registry, options?)` | 注册入口（返回同一 registry） |
| `MongoTypes` | TypeInfo 表；也可测试覆盖 |
| `MongoTypeCatalog` | TypeName / 新类型 vs 追加 / 可否替换默认 |
| `RegisterMongoDBTypesOptions` | 选项类型 |

## 与 Mongoose 一起用

不要把 `lean()` 当成更便宜的 `toObject()`。两者只共享第一步（原生驱动 `bson.deserialize`），之后完全分叉。

**交给 `stringify` 的默认路径：先拿到 Document，再 `doc.toObject({ flattenMaps: true })`。** 不要直接 `stringify` 整个 Mongoose Document。

### 两条路径差在哪

查询执行后，驱动先按上表默认提升（`promoteLongs: true`、`useBigInt64: false`）把 BSON 解成 JS 值，然后：

| | `lean()` | 非 lean + `toObject()` |
| --- | --- | --- |
| Mongoose 做什么 | **跳过 hydrate**。`_completeManyLean` 最多剥 `versionKey`、跑可选的 `lean.transform` | `$init` 对每个 Schema 路径调用 `schemaType.cast()`，再 `clone(_doc)` 成 POJO |
| SchemaType / getter / virtual | **不跑**（官方 [lean 教程](https://mongoosejs.com/docs/tutorials/lean.html) 写明：无 Casting） | 数值形态由 Schema 决定 |
| 结果 | 驱动原始 POJO | 已 cast 过的 POJO（`flattenMaps` 等选项另算） |

### 同一库值，读出来不是同一种 JS 类型

| SchemaType | 非 lean / `toObject()` | `lean()`（驱动默认） |
| --- | --- | --- |
| `BigInt` | 原生 `bigint`（`Long.toBigInt()`） | 安全整数 → `number`；超出安全范围 → `bson.Long` |
| `mongoose-long` 的 `Long` | 一律 `bson.Long`（cast 会把已提升的 `number` 再装回 Long） | 同上：安全 → `number`，超安全 → `Long` |
| `Int32`（内置 / `mongoose-int32`） | `number`（cast 目标就是 number） | `number`（`promoteValues` 提升全部 int，无安全/超安全分叉） |
| `Mixed` | 与 lean 相同（无 cast） | 驱动提升规则原样生效（其中的 BSON int 同样变成 `number`） |
| `Decimal128` / `ObjectId` / `Binary` | bson 实例 | bson 实例（`promoteBuffers` 默认关，subtype 保留） |

同一 `Long[]` 在 `lean()` 里可以 **`number` 与 `Long` 混杂**（例如 `counts: [2, Long("9007199254740993")]`）。这不是本包的 bug，是 mongoose 故意不在 lean 路径上跑 cast；[lean 教程 · BigInts](https://mongoosejs.com/docs/tutorials/lean.html#bigints) 也单独写了默认会把 long 读成 `number`。

### 对 `stringify` 的影响

TASON 只认手里的运行时值，不看 Mongoose Schema：

| 手里的值 | 默认 `unsafe-only` |
| --- | --- |
| `number` / 安全 `bigint` | 裸字面量 `2` |
| 超出安全范围的 `bigint` | `BigInt("…")` |
| `bson.Long`（**含**安全整数） | `Int64("…")` |
| `bson.Int32` | `Int32("…")` |

因此同一字段、同一库值，`lean()` 与 `toObject()` 可以写出不同文本。

### 若必须用 `lean()`

在交给 TASON 之前先把数值收敛到契约类型，任选：

1. **仓储层归一化**（推荐与实体契约对齐）：`BigInt(x)` / `Long.fromNumber` 等，集成测试里的 `toOrderRecord` / `toAssetRecord` 就是这种收口。
2. **`Model.castObject(leanDoc)`**：事后补 Schema cast，仍是 POJO，不是完整 Document。
3. **`query.setOptions({ useBigInt64: true }).lean()`**：所有 BSON long 变成 `bigint`（含 mongoose-long 字段，不再是 `Long`）。安全值也不再是 `number`。

## 范围边界

- **本包：** TASON TypeName ↔ BSON 标量值（`ObjectId`、`Long`、`Decimal128` …）
- **不在本包：** 对象图 `_t` 打标 / `toDocument` / `fromDocument`（见 [`docs/features/polymorphic-persistence/`](../../docs/features/polymorphic-persistence/)）

组合（中间层实现后）：先 `registerMongoDBTypes`，再对对象图调用 `toDocument` / `fromDocument`。两包只通过 **共享 Registry** 组合，本包不 import 中间层。

## 集成测试

`test/integration.mongodb.test.ts`（原生驱动）与 `test/integration.mongoose.test.ts`（mongoose）需要真实 MongoDB 连接（`mongodb` / `mongoose` 均为 devDependency）；两个套件共享 `test/integration.shared.ts` 中的实体与序列化器装配：

1. 在包目录创建 `.env.local`（已被 gitignore），填入真实连接信息：

   ```
   MONGODB_URI=mongodb://user:pass@host:27017
   MONGODB_DB_NAME=tason_integration_test
   ```

2. 运行 `yarn workspace tason-mongodb test`。

加载优先级：进程环境变量 > `.env.local` > `.env`（仓库内只放占位值）。未配置真实连接时集成用例自动 skip，不影响其余测试与 CI。

## License

MIT
