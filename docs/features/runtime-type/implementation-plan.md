# 实施进度：数值 · 运行时契约 · 鸭子类型

> 设计见 [runtime-type-design.md](./runtime-type-design.md)。  
> JS 选项字符串一律 **kebab-case**。

本文是**本 feature 的进度入口**；各阶段细节、任务清单与测试矩阵见分册。  
用语见 [术语与用语](../glossary.md)。

BSON 类型实现、文档 `_t` 不在本文件跟踪。

---

## 进度总览

```
Phase 1 ──► Phase 2.1 ──► Phase 2.2 ──► Phase 3
 选项+值级数值   目录+Valibot+叶子    结构递归+OTP     默认实现 + parseAs
   [done]          [done]            [done]          [done]
```

| 阶段 | 名称 | 状态 | 分册 |
| --- | --- | --- | --- |
| **1** | 数值双选项（无字段上下文） | **已完成** | [phase-1-number-handling.md](./phase-1-number-handling.md) |
| **2.1** | schema 定义与简单应用 | **已完成** | [phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md) |
| **2.2** | 结构递归 + Handling 上下文 + 全数值契约 | **已完成** | 同上 |
| **3** | 默认实现（`asDefault` / `setDefaultType`）+ `parseAs` / `getTypeInfoByCtor` | **已完成** | [phase-3-duck-types.md](./phase-3-duck-types.md) |
| **4** | 统一数值实现协议（`unwrapNumber`，单轨化） | **设计定稿，未实施** | [phase-4-number-protocol.md](./phase-4-number-protocol.md) |

---

## 目标（三阶段）

1. 数值：序列化 / 反序列化 Number Handling 拆分；值级拆箱 / 写出（**阶段 1 ✓**）。
2. ClassMetadata = 现成库 Schema + adapter 做 RuntimeType ↔ TypeInstance / 字面量的对应（**阶段 2**）。
3. 支持鸭子类型注册 + **默认实现可配置** + **`parseAs` 多实现解析**（阶段 3）。

**范围内：** 双 Handling、`RuntimeSchemaAdapter` + 可注册的 Valibot 实现（默认不启用）、RuntimeType ↔ TypeName / 字面量映射、`setDefaultType` / `registerType(..., { asDefault })`、`getTypeInfoByCtor` / `parseAs`、目录整理（`TASONTypeInfo` 顶层、`metadata/`）。

**范围外：** 自研 TypeName DSL 当主 API、ExtraMember、命名约定、多库全适配、Zod 绑进 core、BSON 类型实现、Writer / HTTP、枚举元数据、C# 级 typed 集合 / 接口那一套。

扩展包若要把 `bson.Long` 设为 `Int64` 的默认实现，使用本 feature 已提供的 `asDefault` / `setDefaultType`。具体选项名与类型矩阵不在本文件维护。

---

## 终态 API 速览

```ts
// 数值选项（阶段 1 ✓）
serializeNumberHandling?: "unsafe-only" | "all" | "object-type-property" | "none"  // 序列化与 .NET 同名
deserializeNumberHandling?: "native" | "all" | "object-fallback-native" | "object-fallback-all"

// Class 元数据 + 契约（阶段 2）
registerType(name, typeInfo, metadata?: TasonClassMetadata): void
getClassMetadata(name): TasonClassMetadata | undefined   // 无 getSchema
setSchemaAdapter(adapter | null): void                   // 默认无实现
getSchemaAdapter(): RuntimeSchemaAdapter | undefined
// 导出 createValibotAdapter() → setSchemaAdapter(createValibotAdapter())

// 默认实现 + 期望类型（阶段 3）
registerType(name, typeInfo, metadata?, { asDefault?: boolean })
setDefaultType(name, typeInfo): void
setDefaultTypeByCtor(name, ctor): void
getTypeInfoByCtor(name, ctor): TASONTypeInfo | undefined
parseAs(expected: Constructor | string, text): T
// 再 registerType 同名 = 追加类型实现（不改默认）
```

| Handling（摘要） | 序列化 | 反序列化 |
| --- | --- | --- |
| 默认 | `unsafe-only`：超出安全范围才装箱 | `object-fallback-native`：有契约则按 RuntimeType 转换，否则拆箱 |
| 全拆箱 / 全保留 | — | `native` / `all`（忽略契约） |
| ObjectType 内（无契约时的 fallback） | 序列化：`object-type-property` ≈ all | 反序列化：`object-fallback-all` ≈ all |
| 强制裸写 | `none`（仅序列化） | 无 `none` |

交叉映射的默认路径：`bigint` ↔ Int64 / BigInt（及字面量，随 Handling）；`number` → 裸字面量（**不**默认写成 Int32）；decimal → Decimal128。其它路径用 override / brand / `all` / 追加类型实现。两套类型关系见 [术语与用语](../glossary.md)。

---

## 来源与 C# 对照（摘要）

本功能自 **[tason-net](https://github.com/SwingCosmic/tason-net)**（`TASON/`）迁移，按 JS 能力改造。

| C# | JS 目标 | 备注 |
| --- | --- | --- |
| `TasonTypeInfo.cs` 库根 | `src/TASONTypeInfo.ts` | 阶段 2.1 上移 |
| `Metadata/` | `src/metadata/` | 阶段 2.1 |
| 反射 `PropertyType` | schema + `RuntimeSchemaAdapter` | 无 CLR 反射 |
| `BuiltinNumberHandling` | 读写双选项 | 阶段 1 ✓ |
| `RegisterType(..., metadata)` | 同 + `getClassMetadata` | 阶段 2 |
| 多实现列表 + 第一项为默认 | `registerType` push；**另补** `asDefault` / `setDefaultType`（C# 无此 API） | 阶段 3 |
| `Deserialize<T>` | `parseAs`（TypeInstance 选型子集） | 阶段 3 |

**有意不迁移：** ExtraMember、NamingContract、AllowFields、Enum 元数据。

---

## 代码位置（总表）

| 区域 | 路径 | 阶段 |
| --- | --- | --- |
| 选项 / 值级数值 | `TASONSerializerOptions`、`NumberHandling`、Visitor / Generator | 1 ✓ |
| `TASONTypeInfo` 顶层 | `src/TASONTypeInfo.ts` | 2.1 |
| 元数据 | `src/metadata/*` | 2.1 |
| 契约 adapter / 映射 | `src/schema/*` | 2.1 叶子 ✓ → 2.2 递归 + 边界 |
| Handling 上下文 | `NumberHandling.resolve*`、Visitor / Generator | 2.2（`object-type-property` / ObjectType 内） |
| 结构遍历 | Visitor / Generator `*WithSchema` | 2.2（array + 嵌套 object） |
| 默认实现 / parseAs | Registry、Serializer、Visitor | 3 ✓ |
| 测试 | `number-handling` ✓；`runtime-schema` ✓；`multi-implementation.test.ts` ✓ | 各阶段 |

目标目录（2.1）：

```
src/
  TASONTypeInfo.ts          ← 顶层
  metadata/                 ← decorators + ClassMetadata
  schema/                   ← adapter + map* + adapters/valibot
  types/                    ← 仅 builtin
```

---

## 跨阶段固定决策

| 项 | 决策 |
| --- | --- |
| 参考实现 | tason-net；语义对齐，手段按语言替换 |
| ClassMetadata | Schema + adapter；**`getClassMetadata`**，无 `getSchema` |
| Valibot | 导出现成实现；**默认不注册**；`setSchemaAdapter` 注册 / 替换 / 清除 |
| 存储 | **R1** 挂在 Registry 条目上（不用全局 WeakMap） |
| 无法识别 Schema | 忽略契约，不抛 |
| 阶段 2 测试 | 新开文件覆盖 2.1 + 2.2；未实现的用 skip / todo，默认通过 |
| 默认 Number Handling | serialize `unsafe-only`；deserialize `object-fallback-native` |
| `none` / `native` | `none` 仅序列化；全拆箱名 `native` |
| number → Int32 | 默认不写成 Int32 |
| 选项命名 | kebab-case |

---

## 排期与 PR

| 阶段 | 工作量 | 本 feature 内前置 | 状态 |
| --- | --- | --- | --- |
| 1 | M | — | **done** |
| 2.1 | M–L | 阶段 1 | **done** |
| 2.2 | L | 2.1 | **done** |
| 3 | S–M | 2.2 | **done** |
| 4 | M–L | 阶段 1 + 3（动机来自 tason-mongodb，见 [monorepo](../monorepo/implementation-plan.md) 阶段 C4） | 设计定稿，未实施 |

- PR1 = 阶段 1 ✓
- PR2 = 2.1 ✓ · PR3 = 2.2 ✓ · PR4 = 阶段 3 ✓

---

## 总 DoD

- [x] [阶段 1](./phase-1-number-handling.md)
- [x] [阶段 2.1](./phase-2-class-metadata-schema.md) · [x] 阶段 2.2
- [x] [阶段 3](./phase-3-duck-types.md)
- [x] 测试绿；不以自研 TASON 类型树为主 API
- [x] 与 [runtime-type-design.md](./runtime-type-design.md) 一致
- [x] 面向用户的 README / type-system 已链到本能力

---

## 文档索引

| 文档 | 职责 |
| --- | --- |
| [runtime-type-design.md](./runtime-type-design.md) | 设计 |
| **[implementation-plan.md](./implementation-plan.md)** | **本入口（进度 + 决策摘要）** |
| [phase-1-number-handling.md](./phase-1-number-handling.md) | 阶段 1 |
| [phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md) | 阶段 2 |
| [phase-3-duck-types.md](./phase-3-duck-types.md) | 阶段 3 |
| [phase-4-number-protocol.md](./phase-4-number-protocol.md) | 阶段 4（统一数值实现协议，未实施） |
| [type-system.md](../../type-system.md) | 规范 |
| [tason-net](https://github.com/SwingCosmic/tason-net) | C# 参考实现 |
