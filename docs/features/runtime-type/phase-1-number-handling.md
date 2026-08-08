# 阶段 1：`*NumberHandling` 选项 + 无字段上下文的数值处理

> **状态：已完成**  
> 进度入口：[implementation-plan.md](./implementation-plan.md) · 设计：[runtime-type-design.md](./runtime-type-design.md)  
> 用语：[README 概念对照](./README.md#概念对照读本文档前)

---

## 1.0 目标

增加序列化 / 反序列化数值选项，并在**不涉及类成员字段 / schema 上下文**的路径上实现完整数值策略。

本阶段**不**实现：

- `ClassMetadata.schema`
- 按字段契约收值 / 写出  
- 反序列化 `object-fallback-*` / 序列化 `object-type-property` 的「实体内」语义（见下方降级）

本阶段**要**实现：

- 选项 API、默认值（反序列化类型上无 `none`）  
- 顶层与嵌套数组中的标量数值 TypeInstance 的拆箱 / 保留  
- 原生 `number` / `bigint` / 数值包装类的序列化策略  

---

## 1.1 选项降级语义（无契约 / 无 ObjectType 字段上下文时）

| 选项值 | 阶段 1 实际行为 |
| --- | --- |
| serialize `unsafe-only` | 包装 / bigint 在可安全表示为 number 时裸写；否则 TypeName（含超精度 Decimal） |
| serialize `all` | 包装与 bigint 写 TypeName |
| serialize `object-type-property` | **降级为 `unsafe-only`** |
| serialize `none` | **强制**所有数值为裸字面量（含超大 bigint、超精度 Decimal，永不 TypeName） |
| deserialize `native` | 全拆箱 |
| deserialize `all` | 保留包装 |
| deserialize `object-fallback-native` | **降级为 `native`**（尚无 schema 契约路径） |
| deserialize `object-fallback-all` | **降级为 `native`**（无 OT 上下文时） |

> 阶段 2 接通 schema / ObjectType 上下文后，`object-fallback-*` 恢复设计语义；阶段 1 降级由测试钉死。

---

## 1.2 反序列化拆箱规则（值级）

在 `TASONVisitor` 创建 TypeInstance 之后、返回上层之前：

| TypeName（TypeInstance） | `native` / 降级 `object-fallback-*` | `all` |
| --- | --- | --- |
| UInt8 / Int16 / Int32 / Float32 / Float64 | → `number`（`.value`） | 保留包装实例 |
| Int64 | → `bigint`（`.value`） | 保留 `Int64` |
| BigInt | → `bigint` | → `bigint`（已是原生） |
| Decimal128 | → `Decimal`（`.value`） | 保留 `Decimal128` |
| 其它 TypeInstance | 不处理 | 不处理 |

裸数字字面量（`NumberValue`）阶段 1 **保持现状**（`Decimal`→`toNumber()`），不引入 schema。

---

## 1.3 序列化写出规则（值级）

| RuntimeType / 值 | `unsafe-only` | `all` | `none` |
| --- | --- | --- | --- |
| `number`（有限） | 裸字面量 | 裸字面量 | 裸字面量 |
| `bigint` | safe → 裸 number；unsafe → `BigInt("…")` | `BigInt("…")` | **强制**十进制字面量（含超大） |
| `Int32` 等包装 | 可安全为 number 则裸，否则 TypeName | TypeName | **强制** `.value` 字面量 |
| `Decimal` / `Decimal128` | 可无损为 number 则裸，否则 TypeName | TypeName | **强制**十进制文本（含超精度） |
| 非数值 | 既有逻辑 | 既有逻辑 | 既有逻辑 |

`NaN` / `±Infinity`：保持既有行为（本阶段不扩大 scope）。

---

## 1.4 实现任务清单

| # | 任务 | 文件 | 状态 |
| --- | --- | --- | --- |
| 1.1 | 定义 `SerializeNumberHandling` / `DeserializeNumberHandling`（含 `native`） | `TASONSerializerOptions.ts` | ✓ |
| 1.2 | 构造器默认值：`serializeNumberHandling = "unsafe-only"`，`deserializeNumberHandling = "object-fallback-native"` | `TASONSerializer.ts` | ✓ |
| 1.3 | `unwrapNumberInstance` / `shouldPrefixNumberType` / resolve 降级 | `types/NumberHandling.ts` | ✓ |
| 1.4 | Visitor：`createTypeInstance` 后按 deserialize 选项拆箱 | `TASONVisitor.ts` | ✓ |
| 1.5 | Generator：bigint / 包装类路径读 serialize 选项 | `TASONGenerator.ts` | ✓ |
| 1.6 | 导出类型（index） | `index.ts` | ✓ |
| 1.7 | 测试 N1–N8 | `test/number-handling.test.ts` | ✓ |

---

## 1.5 测试矩阵

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| N1 | 默认选项 parse `Int64("1")` | `1n`（object-fallback-native → native 拆箱） |
| N2 | `deserializeNumberHandling: "all"` parse `Int64("1")` | `Int64` 实例 |
| N3 | `deserializeNumberHandling: "native"` parse `Int32("1")` | `1`（number） |
| N4 | 默认 serialize `unsafe-only`；stringify `1n` / 超大 bigint | `"1"` / `BigInt("…")` |
| N5 | `serializeNumberHandling: "none"` 全部数值含超大 bigint/Decimal | 强制裸字面量 |
| N7 | 嵌套数组 `[[Int64("1")]]` + 默认 deserialize | `[[1n]]` |
| N8 | ser `object-type-property` / de `object-fallback-all` | 分别降级为 unsafe-only / native |

---

## 1.6 DoD

- [x] 双选项进入公开 API，默认值正确  
- [x] 无 schema 时拆箱/写出行为符合 §1.2–1.3  
- [x] ser `object-type-property` / de `object-fallback-*` 降级有测试钉死  
- [x] 既有 parse/stringify 测试已按默认拆箱更新  
- [x] **不**引入 schema 库依赖  

---

## 后续

阶段 2 在阶段 1 值级路径之上接通 ClassMetadata / schema：  
→ [phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md)
