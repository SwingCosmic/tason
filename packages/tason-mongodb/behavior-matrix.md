# tason-mongodb 数值 / 驱动选项矩阵

> 使用入口：[README](./README.md)。本文件只维护行为矩阵，不重复用法。  
> 设计要点与测试覆盖：[docs/features/monorepo/phase-c-bson-types.md](../../docs/features/monorepo/phase-c-bson-types.md) §5。

## 先分清两层选项

数值从 MongoDB 读出、再到写出 TASON 文本，中间经过两个互不相干的决策点，**不要把它们混为一谈**：

1. **驱动层（读库时）**：`bson.deserialize` / Mongo 读选项（`promoteValues` / `promoteLongs` / `useBigInt64` / `promoteBuffers`）决定**你手里拿到的是什么 JS 值**——原生 `number` / `bigint`，还是 `bson.Long` 这类包装实例。这一步发生在 TASON 介入之前。
2. **TASON 层（注册时 + 序列化选项）**：本包的 `replaceDefaultImplementation` 决定**反序列化产出哪个实现**；bson 类如何被序列化则由核心 [Number Handling](../../docs/number-handling.md) 决定，与 `replaceDefaultImplementation` 无关。

一句话：驱动决定「输入是什么」，TASON 决定「输出是什么」。

## 一个关键前提：Handling 只认核心数值包装

Number Handling 的装箱 / 拆箱规则只对**核心数值包装**（核心 `Int64` / `Int32` / `Float64` / `Decimal128` 等）生效。`bson.Long` / `bson.Int32` / `bson.Double` / `bson.Decimal128` **不是**核心包装，因此：

- 默认 `unsafe-only` 下也会写出 TypeName（如 `Int64("1")`），**即使值是安全整数**——因为 Handling 无法把它拆成裸字面量；
- `serializeNumberHandling: "none"` 时会直接**抛错**（同样原因：拆不成裸字面量）。

想要 JSON 风格的裸数字，正确做法是让驱动提升成 `number` / `bigint`（开 `promoteLongs` / `useBigInt64`），而不是对 bson 包装实例开 `none`。

---

## 驱动读出 → 序列化

**这张表回答的问题**：用默认配置调过 `registerMongoDBTypes` 后，驱动按某组读选项交给我一个值，序列化会写出什么文本？

前置条件：已 `registerMongoDBTypes`、Handling 为默认。驱动选项自身的默认值：`promoteValues: true`、`promoteLongs: true`、`useBigInt64: false`、`promoteBuffers: false`。

| BSON | 驱动选项 | JS 值 | 序列化结果 |
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

怎么读：

- 值被驱动**提升**成 `number` / `bigint` 时，后续走核心 Number Handling，安全整数写裸字面量；
- 值保持为 **bson 包装类**时，序列化只能写出对应 TypeName（见上文「关键前提」）；
- Binary 各 subtype 靠 TypeInfo.`match` 区分成不同 TypeName；一旦 `promoteBuffers: true` 把它们统一提升成 Node `Buffer`，subtype 信息就没了，只能写回通用 `Buffer`。

注意：`useBigInt64: true` 时驱动要求同时 `promoteValues` 与 `promoteLongs` 为 true，否则 `bson` 自己抛错。

---

## 反序列化：`replaceDefault` × Handling

**这张表回答的问题**：parse 一段 TASON 文本（如 `Int64("1")`），在「是否替换默认实现」与反序列化 Number Handling 的不同组合下，分别得到什么？

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

怎么读：

- **`replaceDefault` 关**：parse 走核心默认实现，结果由 Handling 决定——`native` 拆成原生值，`all` 保留核心包装。
- **`replaceDefault` 开**：默认实现换成了 bson 类，Handling 对 bson 类不生效（它不是核心包装），所以**任意 Handling 都得到 bson 实例**。
- `ObjectId` 等类型只有 bson 一种实现，行为与开关无关。
- 表中「默认」指 `object-fallback-native`：在值级路径（无 ObjectType 字段、无 schema 契约）下它与 `native` 行为相同。

只想单次换个实现、不改全局默认时，用 `parseAs(Long, 'Int64("1")')` 这类多实现解析 API。

---

## 序列化：bson 数值类 × Handling

**这张表回答的问题**：序列化选项 `serializeNumberHandling` 取不同值时，手里各种形态的数值分别写出什么？

| 值 | `unsafe-only`（默认） | `all` | `none` |
| --- | --- | --- | --- |
| `bson.Long` / `Int32` / `Double` / `Decimal128` | 对应 TypeName（**安全整数也装箱**） | 同上 | **抛错** |
| 核心 `Int64(1)` 等包装 | 安全则裸字面量 | TypeName | 强制裸字面量 |
| 已提升的 `number` / `bigint` | 走核心 Handling | 走核心 Handling | 走核心 Handling |
| `ObjectId` / `Binary` / `UUID` 等非数值 | TypeName | TypeName | TypeName |

怎么读：

- 第一行是「关键前提」的直接后果：bson 数值类不受 Handling 拆箱规则管辖，`none` 下无法产出裸字面量故抛错。
- 第二行才是 Handling 的正常作用范围：核心包装在默认模式下安全整数可裸写。
- 第三行说明：只要让驱动把值提升成原生 `number` / `bigint`，三种 Handling 下行为一致且可控——这是想要 JSON 风格数字时的推荐路径。

上表与 `replaceDefaultImplementation` 开 / 关无关：序列化从实例出发识别实现（见 [类型系统 · 多实现](../../docs/type-system.md#同一-typename-的多种实现)），换默认实现只影响 parse，不改变序列化结果。
