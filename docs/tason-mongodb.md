# tason-mongodb 开发与集成笔记

> 用户手册：[packages/tason-mongodb/README.md](../packages/tason-mongodb/README.md)  
> 数值矩阵：[packages/tason-mongodb/behavior-matrix.md](../packages/tason-mongodb/behavior-matrix.md)  
> 类型设计：[features/monorepo/phase-c-bson-types.md](./features/monorepo/phase-c-bson-types.md)

## bson 持有点

模块加载 **不** import / require `bson`。`src/bson-ns.ts` 默认空引用。

`registerMongoDBTypes` 写入持有点：传入 `options.bson`，省略则 `loadDefaultBson()`（`createRequire(...)('bson')`，CJS 副本，与 `mongodb` / `mongoose.mongo` 同一 class）。

静态 `MongoTypes` / 各 TypeInfo 的 `ctor` 与 `deserialize` 经 getter 读持有点；再注册并换一份 `bson` 时，同一 TypeInfo 对象上的 ctor 跟着变，不必重建表。未绑定就读 `getBson()` / `ctor` 抛错。

`loadDefaultBson()` 只取值，不写入持有点。

本包是 ESM（peer `tason` 也是）。给本包再出 CJS **合并不了** bson 双实例：mongoose 永远 `require('bson')`。

## 与 Mongoose 一起用

不要把 `lean()` 当成更便宜的 `toObject()`。两者只共享第一步（原生驱动 `bson.deserialize`），之后完全分叉。

**交给 `stringify` 的默认路径：先拿到 Document，再 `doc.toObject({ flattenMaps: true })`。** 不要直接 `stringify` 整个 Mongoose Document。

查询执行后，驱动先按默认提升（`promoteLongs: true`、`useBigInt64: false`）把 BSON 解成 JS 值，然后：

| | `lean()` | 非 lean + `toObject()` |
| --- | --- | --- |
| Mongoose 做什么 | **跳过 hydrate**。`_completeManyLean` 最多剥 `versionKey`、跑可选的 `lean.transform` | `$init` 对每个 Schema 路径调用 `schemaType.cast()`，再 `clone(_doc)` 成 POJO |
| SchemaType / getter / virtual | **不跑**（官方 [lean 教程](https://mongoosejs.com/docs/tutorials/lean.html) 写明：无 Casting） | 数值形态由 Schema 决定 |
| 结果 | 驱动原始 POJO | 已 cast 过的 POJO（`flattenMaps` 等选项另算） |

| SchemaType | 非 lean / `toObject()` | `lean()`（驱动默认） |
| --- | --- | --- |
| `BigInt` | 原生 `bigint`（`Long.toBigInt()`） | 安全整数 → `number`；超出安全范围 → `bson.Long` |
| `mongoose-long` 的 `Long` | 一律 `bson.Long`（cast 会把已提升的 `number` 再装回 Long） | 同上：安全 → `number`，超安全 → `Long` |
| `Int32`（内置 / `mongoose-int32`） | `number`（cast 目标就是 number） | `number`（`promoteValues` 提升全部 int，无安全/超安全分叉） |
| `Mixed` | 与 lean 相同（无 cast） | 驱动提升规则原样生效（其中的 BSON int 同样变成 `number`） |
| `Decimal128` / `ObjectId` / `Binary` | bson 实例 | bson 实例（`promoteBuffers` 默认关，subtype 保留） |

同一 `Long[]` 在 `lean()` 里可以 **`number` 与 `Long` 混杂**。这不是本包的 bug，是 mongoose 故意不在 lean 路径上跑 cast；[lean 教程 · BigInts](https://mongoosejs.com/docs/tutorials/lean.html#bigints) 也单独写了默认会把 long 读成 `number`。

TASON 只认手里的运行时值，不看 Mongoose Schema：

| 手里的值 | 默认 `unsafe-only` |
| --- | --- |
| `number` / 安全 `bigint` | 裸字面量 `2` |
| 超出安全范围的 `bigint` | `BigInt("…")` |
| `bson.Long`（**含**安全整数） | `Int64("…")` |
| `bson.Int32` | `Int32("…")` |

因此同一字段、同一库值，`lean()` 与 `toObject()` 可以写出不同文本。

配合 `mongoose-long`：注册时 `bson: mongoose.mongo`（或省略以用 CJS 默认，通常已是同一份）。`Schema.Types.Int32` **不**对称：cast 目标是 `number`，内存不是 `bson.Int32`。

若必须用 `lean()`，在交给 TASON 之前先把数值收敛到契约类型：

1. **仓储层归一化**（推荐）：`BigInt(x)` / `Long.fromNumber` 等，集成测试里的 `toOrderRecord` / `toAssetRecord` 就是这种收口。
2. **`Model.castObject(leanDoc)`**：事后补 Schema cast，仍是 POJO，不是完整 Document。
3. **`query.setOptions({ useBigInt64: true }).lean()`**：所有 BSON long 变成 `bigint`（含 mongoose-long 字段，不再是 `Long`）。安全值也不再是 `number`。

## 范围边界

- **本包：** TASON TypeName ↔ BSON 标量值（`ObjectId`、`Long`、`Decimal128` …）
- **不在本包：** 对象图 `_t` 打标 / `toDocument` / `fromDocument`（见 [polymorphic-persistence](./features/polymorphic-persistence/)）

组合：先 `registerMongoDBTypes`，再对对象图调用 `toDocument` / `fromDocument`。两包只通过 **共享 Registry** 组合，本包不 import 中间层。

## 集成测试

`test/integration.mongodb.test.ts`（原生驱动）与 `test/integration.mongoose.test.ts`（mongoose）需要真实 MongoDB 连接；两个套件共享 `test/integration.shared.ts`。

1. 在包目录创建 `.env.local`（已被 gitignore）：

   ```
   MONGODB_URI=mongodb://user:pass@host:27017
   MONGODB_DB_NAME=tason_integration_test
   ```

2. `yarn workspace tason-mongodb test`

加载优先级：进程环境变量 > `.env.local` > `.env`（仓库内只放占位值）。未配置真实连接时集成用例自动 skip。

另有 `test/esm-driver-bson.mjs`：原生 ESM 下确认持有点默认空、`loadDefaultBson()` 不绑定、CJS Long 与 `mongoose.mongo.Long` 同一 class。
