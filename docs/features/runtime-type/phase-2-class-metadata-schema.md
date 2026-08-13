# 阶段 2：Class 元数据 + schema 库

> **状态：2.1 · 2.2 已完成**  
> 进度入口：[implementation-plan.md](./implementation-plan.md) · 设计：[runtime-type-design.md](./runtime-type-design.md)  
> 用语：[README 概念对照](./README.md#概念对照读本文档前)  
> 依赖：[阶段 1](./phase-1-number-handling.md)（已完成）

实现 **ClassMetadata = 现成库 Schema** 作为接口协定，经 adapter 映射到 TypeName / TypeInstance（或字面量）。  
语义对照 C#：`ITasonTypeMetadata` 告诉 ser/de「成员有哪些、期望什么类型」；JS 用 **schema walk** 替代 **CLR 反射**（参考 `E:\dev\VS2022\tason-net`）。

| 子阶段 | 焦点 | 不做 | 状态 |
| --- | --- | --- | --- |
| **2.1** | 目录重构、Valibot 导出、adapter 骨架、注册 metadata、**简单叶子** | 多维数组完备、override、object-type-property 全语义、decimal 完备 | **done** |
| **2.2** | 递归 walk（array/嵌套 object）+ 全数值边界 + OTP 上下文 | 多实现解析、无 schema 记 TypeName、override/brand（[阶段 3](./phase-3-duck-types.md) / 2.2b） | **done** |

---

## 2.0 总览

### 数据流（对照 C#）

```
C#:  Type → TasonTypeMetadataProvider.GetMetadata(type)
         → Properties[name].PropertyType
         → TypedValueContext(value, propertyType)

JS:  typeName → getClassMetadata → schema
         → adapter.objectEntries / runtimeType(fieldSchema)
         → mapTypeInstanceToRuntime(kind, value, handling)
```

### 与阶段 1 的衔接

| 路径 | 阶段 1 | 2.1 | 2.2 |
| --- | --- | --- | --- |
| 顶层 / 数组元素数值 | Handling 值级 | 不变 | 数组元素可按 schema |
| ObjectType 字段数值 | 同值级 | **有 metadata 的叶子**按契约 | 全嵌套 + 全 Handling |
| `object-fallback-native` | 降级 `native` | 叶子有契约时按 kind；其余可降级 | **取消降级** |
| `object-fallback-all` | 降级 | 仍降级 | **接通真实语义**（有契约时 schema 优先） |

### 目标目录（2.1 落地）

```
src/
  TASONTypeInfo.ts              ← 自 types/ 上移
  metadata/
    index.ts
    decorators.ts               ← 原 types/metadata.ts
    ClassMetadata.ts
  schema/
    RuntimeType.ts
    RuntimeSchemaAdapter.ts
    mapTypeInstanceToRuntime.ts # 2.1 叶子；2.2 补全
    mapRuntimeToTypeInstance.ts
    adapters/valibot.ts         # 导出；默认不注册
  types/                        # 仅 builtin
```

| 现状 | 目标 |
| --- | --- |
| `src/types/TASONTypeInfo.ts` | `src/TASONTypeInfo.ts` |
| `src/types/metadata.ts` | `src/metadata/decorators.ts` + `index.ts` |

---

# 阶段 2.1：schema 定义与简单应用

> **已完成。** 目录重构、Valibot 一键 adapter、ClassMetadata、叶子映射与 S0–S9 测试已落地。

### 实施顺序

```
A. 目录重构（纯移动 + import，行为零变更）
   → B. 锁定 Valibot + peer/devDep
   → C. RuntimeSchemaAdapter + Valibot 实现（导出，默认不注册）
   → D. setSchemaAdapter + ClassMetadata + registerType 第三参
   → E. Visitor/Generator 叶子映射
   → F. 阶段 2 全场景测试（未实现用例默认通过）
```

---

## 2.1.1 目录重构

**动机：** 对齐 C#（`TasonTypeInfo` 库根、`Metadata/` 独立）；`types/` 只放 builtin。

| 边界 | 职责 |
| --- | --- |
| `TASONTypeInfo` | 类型如何 ser/de 自身 |
| `metadata/` | 附加契约与装饰器 |
| `schema/` | Schema introspect + TypeName/TypeInstance 映射 |
| `types/` | 内置类型实现 |

| # | 动作 |
| --- | --- |
| A1 | `TASONTypeInfo.ts` → `src/` 顶层 |
| A2–A4 | 建 `metadata/`，迁 decorators，删旧路径 |
| A5 | 全局更新 import（Registry、json、`defineType` 引用等） |
| A6 | **既有测试全绿**后再进入 B |

---

## 2.1.2 Schema 库选型（**已决议：Valibot**）

| 候选 | 结论 |
| --- | --- |
| **Valibot** | 官方导出一键实现；**默认不注册** |
| TypeBox / Zod | 社区可自写 adapter |

| 维度 | Valibot |
| --- | --- |
| 树摇 / 重量 | 优 |
| introspect | 标准 schema 树可 walk |
| `bigint` | `v.bigint()` 一等公民 |
| 绑定 | optional peer；core 不硬依赖 |

```jsonc
// package.json（示意；实施时钉死主版本）
{
  "peerDependencies": { "valibot": "^1.0.0" },
  "peerDependenciesMeta": { "valibot": { "optional": true } },
  "devDependencies": { "valibot": "^1.0.0" }
}
```

- 默认无 `RuntimeSchemaAdapter` → 行为 = 阶段 1。  
- 一键：`registry.setSchemaAdapter(createValibotAdapter())`。

---

## 2.1.3 Adapter 最小接口（冻结）

```ts
export type RuntimeType =
  | "bigint" | "number" | "string" | "boolean"
  | "decimal" | "object" | "array"
  | "instance"  // class 实例；ctor 见 instanceCtor —— 不是 TypeName
  | "unknown";

export interface RuntimeSchemaAdapter<S = unknown> {
  isSchema(value: unknown): value is S;
  objectEntries(schema: S): Iterable<[string, S]> | null;
  arrayElement(schema: S): S | null;
  /** 叶子或结构的 JS RuntimeType（不写 TypeName） */
  runtimeType(schema: S): RuntimeType;
  /** runtimeType==="instance" 时返回期望构造函数，如 RegExp / Date */
  instanceCtor(schema: S): (abstract new (...args: any[]) => any) | null;
}
```

Valibot 示例：字段是正则 → **`v.instance(RegExp)`**（不是 TypeName 字符串）；Date → **`v.date()`** 或 `v.instance(Date)`。  
adapter 报告 `"instance"` + ctor；`Registry.findTypeNameByCtor` / `createInstanceByCtor` 再落到 TypeName。

| 能力 | 2.1 | 2.2 |
| --- | --- | --- |
| object + 叶子 bigint/number/string/boolean | **必须** | ✓ |
| 一维 array introspect | 应支持 | 元素映射全量 |
| 嵌套 object / 多维 array 映射 | adapter 可 walk | Visitor/Generator 递归 |
| optional / nullable | 尽量 | 完善 |
| decimal kind | 可识别 | 映射完备 |

**Valibot（`createValibotAdapter()`）：** 识别 schema；walk object/array；叶子 kind 映射；optional 尽量解包。

---

## 2.1.4 元数据与 adapter 入口

公开 **TASON 自身 API**，不抬高外部库细节：

```ts
export interface TasonClassMetadata<S = unknown> {
  ctor?: abstract new (...args: any[]) => any;
  /** 不透明契约；由已注册 adapter 解释 */
  schema: S;
}

registerType(name, typeInfo, metadata?: TasonClassMetadata): void
getClassMetadata(name: string): TasonClassMetadata | undefined
// 无 getSchema —— 需要时 getClassMetadata(name)?.schema

setSchemaAdapter(adapter: RuntimeSchemaAdapter | null): void
getSchemaAdapter(): RuntimeSchemaAdapter | undefined
```

| 项 | 决策 |
| --- | --- |
| 存储 | **R1**：Registry entry 旁路（与 register 同生命周期）。不用 R2 全局 WeakMap（JS 无 .NET Type 表） |
| 默认 adapter | **不注册** |
| 官方实现 | 导出 `createValibotAdapter()`，不自动挂载 |
| 替换 / 清除 | 再 `set` / `set(null)` |

无 adapter 时即使有 `metadata.schema`，也**忽略契约**。

**示例：**

```ts
import * as v from "valibot";
import { createValibotAdapter } from "tason";

registry.setSchemaAdapter(createValibotAdapter());

registry.registerType(
  "User",
  { kind: "object", ctor: User },
  { schema: v.object({ id: v.bigint(), name: v.string(), age: v.number() }) },
);

registry.getClassMetadata("User"); // { schema: … }
```

装饰器（`@TASONType` 等）留在 `metadata/decorators.ts`；2.1 不强制与 schema 合并。

---

## 2.1.5 简单应用（叶子）

**前置：** 默认 `object-fallback-native` + 已 `setSchemaAdapter` + 类型有 metadata。

**反序列化：** bag → `getClassMetadata` → adapter walk → 按 kind `mapTypeInstanceToRuntime` → `createInstance`。  
**序列化：** 识别类型 → metadata + adapter walk → 按 kind + serialize Handling 写出类型名或字面量。  
**回退：** 无 metadata / 无 adapter / `unknown` → 阶段 1 值级。

**2.1 不做：** 多维数组元素契约收值、object-type-property 取消降级、字段类型名 override、强制 `v.parse`。

### 叶子映射子集

| RuntimeType | TypeName / 字面量（例） | object-fallback-native 收值 | serialize（unsafe-only） |
| --- | --- | --- | --- |
| bigint | `Int64("1")` | `1n` | 安全裸 / 否则类型名装箱 |
| number | `Int32("18")` / `18` | number | 裸字面量 |
| string / boolean | | 透传 | 字面量 |
| 无契约 | | 阶段 1 | 阶段 1 |

---

## 2.1.6 任务清单

| # | 任务 | 落点 |
| --- | --- | --- |
| A1–A6 | 目录重构 | §2.1.1 |
| B1 | Valibot peer + optional + devDep | package.json |
| C1–C2 | Adapter 接口 + 导出 Valibot 实现 | `src/schema/` |
| D1–D3 | ClassMetadata（R1）、`getClassMetadata`、`setSchemaAdapter` | metadata + Registry |
| E1–E3 | `mapTypeInstanceToRuntime` / `mapRuntimeToTypeInstance` 叶子 + Visitor/Generator | schema + Visitor/Generator |
| F1–F2 | 新开阶段 2 测试；一键注册文档 | `test/runtime-schema*.test.ts` |

建议提交：

1. `refactor: move TASONTypeInfo to root, extract metadata/`  
2. `feat: RuntimeSchemaAdapter + setSchemaAdapter + export valibot`  
3. `feat: registerType metadata + getClassMetadata + leaf mapping`  
4. `test: runtime-schema suite (2.2 cases skipped)`  

---

## 2.1.7 测试策略与矩阵

| 规则 | 说明 |
| --- | --- |
| 新开文件 | 不改 `number-handling.test.ts`；如 `test/runtime-schema.test.ts` |
| 覆盖阶段 2 全场景 | S1–S17 一次写全 |
| 未实现默认通过 | 2.2 用例 `it.skip` / `it.todo`，2.2 再 unlock |
| fixture | 契约用例显式 `setSchemaAdapter(createValibotAdapter())` |

```ts
const PHASE_2_2 = false;
(PHASE_2_2 ? it : it.skip)("S10 bigint[] …", () => { /* … */ });
```

### 2.1 必测（真实断言）

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| S0 | 目录重构后既有测试 | 全绿 |
| S1 | adapter + metadata `id: bigint`，parse Int64 | `1n` |
| S2 | `age: number`，parse Int32 | `18` number |
| S3 | 无 metadata 的 ObjectType | 同阶段 1 |
| S4 | stringify 带 metadata 的 User | 按 serialize Handling |
| S5 | adapter 无法识别 schema | 忽略契约，不抛 |
| S6 | `native` + 有 metadata | 忽略契约，全拆箱 |
| S7 | **未** set adapter，有 schema | 同阶段 1 |
| S8 | set 替换 / null 清除 | 行为随 adapter |
| S9 | `getClassMetadata` | 可读回；无公开 `getSchema` |

### 2.2 场景（2.1 时 skip；见 §2.2.7）

S10–S17。

---

## 2.1.8 DoD

- [x] `TASONTypeInfo` 顶层；`metadata/` 就位  
- [x] 导出 Valibot 实现；**默认不注册** adapter  
- [x] `setSchemaAdapter` / `getSchemaAdapter`  
- [x] `registerType(..., metadata)` + **`getClassMetadata`**（无 `getSchema`）  
- [x] adapter + metadata 时叶子按契约收值/写出  
- [x] 无 adapter / 无 metadata / `native` 零回归  
- [x] 阶段 2 测试全场景落盘；2.2 用例默认通过（skip）  
- [x] 文档：一键 `setSchemaAdapter(createValibotAdapter())`  
- [x] 不引入第二套 TASON 字段类型 DSL  

### 2.1 落点速查

| 能力 | 路径 |
| --- | --- |
| `TASONTypeInfo` | `src/TASONTypeInfo.ts` |
| 装饰器 / ClassMetadata | `src/metadata/` |
| Adapter + 映射 + Valibot | `src/schema/` · `createValibotAdapter()` |
| Registry | `setSchemaAdapter` / `getClassMetadata` / `registerType(..., metadata?)` |
| 测试 | `test/runtime-schema.test.ts`（S1–S9；S10–S17 skip） |

```ts
import * as v from "valibot";
import TASON, { createValibotAdapter } from "tason";

const s = new TASON.Serializer();
s.registry.setSchemaAdapter(createValibotAdapter());
s.registry.registerType(
  "User",
  { kind: "object", ctor: User },
  { schema: v.object({ id: v.bigint(), name: v.string(), age: v.number() }) },
);
```

---

# 阶段 2.2：完整数值类型处理

> **已完成。** 对照 C#：`FillObjectMembers` + `TypedValueContext` + `ObjectTypeProperty`/`ValueScope`；JS 用 **schema walk + map\*** + `inObjectType` 上下文。

### 目标（P1）

在 **已 set adapter + ObjectType 有 metadata** 时：

1. **结构递归**：字段为 `array` / 嵌套 `object` 时按 element / entries 契约映射（一维、二维数组 + plain 嵌套 object）。  
2. **全数值族叶子**：UInt8…Decimal128 / BigInt / 裸字面量 × 契约 `bigint` | `number` | `decimal`（与设计 §4.3 默认路径一致）。  
3. **Handling 真实语义**：`object-fallback-*` 在契约路径上按 RuntimeType 收；`object-fallback-all` 无契约时 OT 内 ≈ all。序列化仍用 `object-type-property`（与 .NET 一致）。  
4. **回退不变**：无 adapter / 无 metadata / `native` / 无法识别 schema → 仍等同阶段 1。

**2.2 不做（2.2b / P2 / 阶段 3）：** 字段级 TypeName override、Valibot brand 路径、反序列化后强制 `v.parse`、无 schema 时“记住数组元素 TypeName”侧信道、鸭子选型、多维压力测专项。

---

## 2.2.0 代码基线与缺口（相对 2.1）

2.1 已落地、**2.2 应复用而非重写**的部分：

| 能力 | 落点 | 2.1 状态 |
| --- | --- | --- |
| Adapter 接口 `arrayElement` / `objectEntries` / unwrap optional | `RuntimeSchemaAdapter` + `adapters/valibot.ts` | **已有**（Valibot 可 walk 数组与包装层） |
| 叶子 `mapTypeInstanceToRuntime` / `mapRuntimeToTypeInstance` | `src/schema/map*.ts` | **已有**（bigint / number / decimal / instance） |
| ObjectType + metadata 入口 | `TASONVisitor.ObjectTypeInstance` / `TASONGenerator.TypeInstanceValue` | **仅叶子**：`kind` 为 `object`/`array` 时 **透传不映射** |
| 是否应用契约 | `shouldApplySchemaContract()` | `object-fallback-native` **或** `object-fallback-all` |
| Handling 解析 | `NumberHandling.resolve*` | de：`object-fallback-all` 在 OT 内 ≈ all；ser：`object-type-property` 在 OT 内 ≈ all |
| 测试 S10–S17 | `test/runtime-schema.test.ts` | `PHASE_2_2=false` 的 **空 skip 桩** |

### 缺口清单（2.2 必须填）

| # | 缺口 | 现象 | 目标 |
| --- | --- | --- | --- |
| G1 | Visitor 不递归结构 | `ObjectWithSchema` 对 `object`/`array` 字段直接 `pair.value` | 嵌套 object 再 walk；array 按 `arrayElement` 逐元素映射 |
| G2 | Generator 不递归结构 | `ObjectValueWithSchema` 对 `object`/`array` 走普通 `Value` | 嵌套 object / 数组元素按契约写出 |
| G3 | Array 无 schema 通道 | `Array` / 数组写出无 element schema | 新增带 element schema 的 ser/de 路径 |
| G4 | OTP 全局降级 | `resolveSerialize/Deserialize*` 不看上下文 | **有 ObjectType 字段上下文**时 OTP ≈ all；外层仍降级 |
| G5 | object-fallback-native 语义半残 | 有契约叶子已映射；无契约路径仍靠全局 native 拆箱 | 契约路径完整；无契约 = 阶段 1（可保留 resolve 降级） |
| G6 | 边界未钉 | Int64→number 超安全整数、非整数→bigint 等 | 默认策略写入下文并测 S16 |
| G7 | S10–S17 无断言 | `expect(true).toBe(false)` 桩 | 真实场景 + `PHASE_2_2 = true` |

> **调整说明（相对旧 2.2 任务表）：**  
> 旧「2.2.1 adapter：array 嵌套、optional」在 Valibot adapter 上 **已基本完成**，2.2 只补 **Visitor/Generator 真正调用** `arrayElement` 递归，不再当作 adapter 从零任务。  
> 旧「2.2.2 统一 map\* 全数值族」叶子已齐；2.2 重点是 **结构入口 + 边界策略 + OTP 上下文**，map\* 仅补边界，不重做叶子表。

---

## 2.2.1 Handling 语义（2.2 决议）

### 何时应用 schema 契约（反序列化）

| `deserializeNumberHandling` | 有 adapter + 字段 schema 契约 | 无契约 / 无 adapter |
| --- | --- | --- |
| `native` | **忽略**契约，全拆箱 | 阶段 1 |
| `all` | **不**做契约收值（保留包装/原值） | 阶段 1 |
| `object-fallback-native`（默认） | **应用**契约 → RuntimeType | 值级 native 拆箱 |
| `object-fallback-all` | **同样应用契约 → RuntimeType**（契约优先） | OT 内 ≈ `all`；外 ≈ `native` |

**优先级（反序列化，有 ClassMetadata.schema 时）：**

```text
native / all              → 明确忽略契约
object-fallback-native    → 有契约 → RuntimeType；无契约 → native
object-fallback-all       → 有契约 → RuntimeType；无契约 → OT 内 all、外 native
```

说明：

- ClassMetadata/schema 是 **RuntimeType 契约**，不是可被 fallback 压掉的可选提示。  
- 两档 `object-fallback-*` 仅在 **无字段契约** 时不同（native vs OT 内 all）。  
- **`objectTypeDepth`** 只服务「无契约 + object-fallback-all」路径，**不**用于压过 schema。  
- 序列化侧名称仍为 **`object-type-property`**（与 .NET 一致），勿与 de 的 `object-fallback-all` 混淆。

### 序列化

| `serializeNumberHandling` | ObjectType + schema 叶子/元素 | 其它 |
| --- | --- | --- |
| `unsafe-only` / `all` / `none` | `mapRuntimeToTypeInstance(kind, value, handling)` | 阶段 1 值级 |
| `object-type-property` | 有效策略 = **`all`**（ObjectType 内） | 有效 = **`unsafe-only`** |

`resolveSerializeNumberHandling(handling, { inObjectType?: boolean })`  
`resolveDeserializeNumberHandling(handling, { inObjectType?: boolean })`  
—— 第二参由 Visitor/Generator 在 ObjectType 路径传入；**缺省**保持阶段 1 降级，保证旧测与无上下文路径零回归。

### 覆盖矩阵（反序列化 · object-fallback-native + 契约）

| 入站值 | 契约 bigint | 契约 number | 契约 decimal | 无契约 |
| --- | --- | --- | --- | --- |
| UInt8/Int16/Int32 包装 | → bigint（整数） | → number | → Decimal | 阶段 1 拆箱 |
| Int64 / BigInt | → bigint | → number（**安全整数**；超范围 **抛错**）* | → Decimal | 阶段 1 |
| Float32/Float64 | 非整数 → **抛错**；整数 → bigint | → number | → Decimal | 阶段 1 |
| Decimal128 / Decimal | 整数 → bigint；非整数 → 抛错 | → number（`toNumber`） | → Decimal | 阶段 1 |
| 裸 number 字面量 | 整数 → bigint；非整数 → 抛错 | → number | → Decimal | 现状 |
| 字符串字面量 | **拒绝**（字面量保真） | 拒绝 | 拒绝 | 透传 string |

\* **S16 默认策略（2.2 钉死）：** 契约 `number` + `bigint`/`Int64` 仅当 `Number.isSafeInteger(Number(bi))` 且往返不丢精度时收为 number；否则抛错。不静默截断。

### 序列化默认路径（有契约时，与设计 §4.3）

| RuntimeType | unsafe-only | all | none | object-type-property（OT 内） |
| --- | --- | --- | --- | --- |
| bigint | 安全裸字面量 / 否则 `BigInt("…")` | 尽量 `BigInt("…")` | 强制裸 | ≈ all |
| number | 裸字面量 | 裸字面量（**不**默认 Int32） | 裸 | 裸 |
| decimal | 安全则裸 / 否则 `Decimal128("…")` | `Decimal128` | 强制裸 | ≈ all |

### 结构遍历

| 结构 | 反序列化 | 序列化 |
| --- | --- | --- |
| 叶子（bigint/number/…/instance） | `mapTypeInstanceToRuntime` | `mapRuntimeToTypeInstance` → emit |
| `array(element)` | 每元素按 element schema 递归 | 每元素按 element kind 写出 |
| `array(array(…))` | 两层 `arrayElement` | 同上 |
| 嵌套 plain `object` | `objectEntries` 递归（**不必** registerType） | 递归字段写出为对象字面量 |
| 字段值已是 **嵌套 ObjectTypeInstance**（文本里带 TypeName） | 走既有 `TypeInstance` 路径；若该类型也有 metadata 则各自应用 | 若值被识别为已注册类型 → 既有 `TypeInstanceValue` |

---

## 2.2.2 实施顺序

```
A. Handling 上下文（resolve* + 调用点传 inObjectType）
   → B. map* 边界补强（S16 策略；必要时单测 map 函数）
   → C. Visitor 递归：ObjectWithSchema 支持 object/array + ArrayWithSchema
   → D. Generator 递归：ObjectValueWithSchema + ArrayValueWithSchema
   → E. 解锁 S10–S17 真实断言；补交叉抽样
   → F. 文档：type-system / phase 状态 / 本分册 DoD
```

建议提交切分：

1. `feat: contextual object-type-property for NumberHandling`  
2. `feat: recursive schema walk in Visitor/Generator (array + nested object)`  
3. `test: unlock phase 2.2 runtime-schema S10–S17`  
4. `docs: phase 2.2 complete + type-system notes`

---

## 2.2.3 任务清单（细化）

| # | 任务 | 落点 | 验收要点 |
| --- | --- | --- | --- |
| **A1** | `resolveSerializeNumberHandling` / `resolveDeserializeNumberHandling` 增加可选上下文 | `src/types/NumberHandling.ts` | 默认无 ctx = 阶段 1；`inObjectType: true` 时 OTP → all |
| **A2** | 所有 resolve 调用点：ObjectType 路径传 `inObjectType: true`；顶层数组/标量不传或 false | Visitor `createTypeInstance` / unwrap；Generator 写出数值 | 阶段 1 N8 等测仍绿 |
| **A3** | `shouldApplySchemaContract`：`object-fallback-native` **与** `object-fallback-all` | `TASONVisitor.ts` | 有契约字段收到 RuntimeType；无契约 object-fallback-all 仍 OT≈all |
| **B1** | `toNumber`：bigint 超 `MAX_SAFE_INTEGER` 抛错（安全整数才收） | `mapTypeInstanceToRuntime.ts` | S16 |
| **B2** | `toBigInt`：非整数 number/Decimal 抛错（已有整数检查则核对） | 同上 | 交叉测 |
| **B3** | 序列化 map 与 § 序列化表一致；`number` 永不默认 Int32 | `mapRuntimeToTypeInstance.ts` | 既有 S4 + S13 ser 抽样 |
| **C1** | `ObjectWithSchema`：`kind === "object"` → 子 schema 再 `ObjectWithSchema`；值须为 plain object bag | `TASONVisitor.ts` | S12 |
| **C2** | `kind === "array"` → `ArrayWithSchema(values, elementSchema)` | 同上 | S10 / S11 |
| **C3** | `ArrayWithSchema`：对每个元素看 element 的 `runtimeType`；叶子 map；嵌套 array/object 再递归 | 同上 | 多维 |
| **C4** | 元素/字段 `unknown` 或 adapter 失败 → 透传，不抛 | 同上 | S5 精神延续 |
| **D1** | `ObjectValueWithSchema`：`object`/`array` 字段递归 | `TASONGenerator.ts` | S10–S12  round-trip |
| **D2** | `ArrayValueWithSchema(arr, elementSchema)` | 同上 | 数组元素按 kind 写出 |
| **D3** | 序列化 OTP：ObjectType + schema 路径用有效 `all`（经 A1 或局部 effective） | Generator + resolve | S14 |
| **E1** | `PHASE_2_2 = true`；S10–S17 写满真实断言 | `test/runtime-schema.test.ts` | 全绿 |
| **E2** | 可选：map\* 边界单测或并入 S13/S16 | 同文件或 `map*.test` | 边界稳定 |
| **F1** | 本分册 2.2 DoD 勾选；总进度 `implementation-plan` 2.2 → done（完成时） | docs | — |
| **F2** | `type-system.md` / README 链到契约递归与 OTP 语义（完成时） | docs | — |

### 明确不做（防范围膨胀）

| 项 | 去向 |
| --- | --- |
| adapter 重写 / 第二 schema 库 | 不做；Valibot 已够 walk |
| 无 metadata 的「记录 TypeName」 | 2.2b |
| 字段 override / brand | 2.2b |
| `v.parse` 强制校验 | 2.2b |
| 鸭子 / `parseAs` | 阶段 3 |

---

## 2.2.4 测试矩阵（解锁后真实断言）

解锁方式：

```ts
const PHASE_2_2 = true; // 2.2 开工时改为 true
const it22 = PHASE_2_2 ? it : it.skip;
```

| 编号 | 场景 | 期望（摘要） |
| --- | --- | --- |
| **S10** | schema `ids: v.array(v.bigint())`；parse `User({ids:[Int64("1"),2]})` | `ids === [1n, 2n]`；元素均为 bigint |
| **S11** | `matrix: v.array(v.array(v.number()))`；含 `Int32` / 字面量 | `number[][]`；元素 typeof number |
| **S12** | 嵌套 plain object `profile: v.object({ score: v.bigint() })`；`score:Int64("9")` | `profile.score === 9n`；无需 register `Profile` |
| **S13** | 单 ObjectType 多字段：UInt8…Decimal128 / BigInt 与契约 bigint\|number\|decimal 交叉抽样 | object-fallback-native 下按 § 覆盖矩阵收值；stringify 抽样符合 serialize Handling |
| **S14** | serialize `object-type-property` + metadata 大 bigint | **OT 内**按 all 写出类型名（如 `BigInt("…")`），不是 unsafe-only 裸写 |
| **S15** | `object-fallback-all` + 有/无 schema | **有 schema** → RuntimeType；**无 schema** → OT 内保留包装；顶层仍拆箱 |
| **S16** | 契约 `number` + `Int64` 安全整数 → number；`Int64` 超 `MAX_SAFE_INTEGER` → **抛错** | 钉死 B1 |
| **S17** | 无 metadata 或未 set adapter | 与阶段 1 / 2.1 S3·S7 一致；数组也不误用契约 |

既有 `number-handling.test.ts`、`runtime-schema.test.ts` 必须保持全绿。

---

## 2.2.5 DoD

- [x] A1–A3：object-fallback-* / ser object-type-property 语义与 §2.2.1 一致；无上下文路径零回归  
- [x] C1–C4 / D1–D2：数组与嵌套 object walk 正确（S10–S12）  
- [x] B1–B3 + S13/S16：数值族与边界符合默认策略  
- [x] S14–S15：ser OTP + de object-fallback-all 上下文语义  
- [x] S17 + 阶段 1 测：无契约回退  
- [x] 映射与设计 §4.3 / §4.4 一致；无第二套 TASON 字段 DSL  
- [x] `PHASE_2_2` 解锁；S10–S17 全部真实断言  
- [x] 文档进度勾选（type-system 细则可随阶段 3 再补）  

### 2.2 落点速查（完成后）

| 能力 | 路径 |
| --- | --- |
| Handling 上下文 | `NumberHandling.resolve*(h, { inObjectType? })` |
| 递归 de | `TASONVisitor` · `ObjectWithSchema` / `ArrayWithSchema` |
| 递归 ser | `TASONGenerator` · `ObjectValueWithSchema` / `ArrayValueWithSchema` |
| 叶子边界 | `mapTypeInstanceToRuntime` / `mapRuntimeToTypeInstance` |
| 测试 | `test/runtime-schema.test.ts`（S10–S17 live） |

---

## 相关链接

- 上一阶段：[phase-1-number-handling.md](./phase-1-number-handling.md)  
- 下一阶段：[phase-3-duck-types.md](./phase-3-duck-types.md)  
- 总进度：[implementation-plan.md](./implementation-plan.md)  
