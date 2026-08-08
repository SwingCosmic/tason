# 阶段 2：Class 元数据 + schema 库

> **状态：2.1 已完成 · 2.2 下一步**  
> 进度入口：[implementation-plan.md](./implementation-plan.md) · 设计：[runtime-type-design.md](./runtime-type-design.md)  
> 用语：[README 概念对照](./README.md#概念对照读本文档前)  
> 依赖：[阶段 1](./phase-1-number-handling.md)（已完成）

实现 **ClassMetadata = 现成库 Schema** 作为接口协定，经 adapter 映射到 TypeName / TypeInstance（或字面量）。  
语义对照 C#：`ITasonTypeMetadata` 告诉 ser/de「成员有哪些、期望什么类型」；JS 用 **schema walk** 替代 **CLR 反射**（参考 `E:\dev\VS2022\tason-net`）。

| 子阶段 | 焦点 | 不做 | 状态 |
| --- | --- | --- | --- |
| **2.1** | 目录重构、Valibot 导出、adapter 骨架、注册 metadata、**简单叶子** | 多维数组完备、override、object-type-property 全语义、decimal 完备 | **done** |
| **2.2** | 全部内置数值 + 数组/嵌套 + Handling 完整咬合 | 鸭子选型（[阶段 3](./phase-3-duck-types.md)） | **next** |

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
| `record-type` | 降级 `native` | 叶子有契约时按 kind；其余可降级 | **取消降级** |
| `object-type-property` | 降级 | 仍降级 | **接通真实语义** |

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

**前置：** 默认 `record-type` + 已 `setSchemaAdapter` + 类型有 metadata。

**反序列化：** bag → `getClassMetadata` → adapter walk → 按 kind `mapTypeInstanceToRuntime` → `createInstance`。  
**序列化：** 识别类型 → metadata + adapter walk → 按 kind + serialize Handling 写出类型名或字面量。  
**回退：** 无 metadata / 无 adapter / `unknown` → 阶段 1 值级。

**2.1 不做：** 多维数组元素契约收值、object-type-property 取消降级、字段类型名 override、强制 `v.parse`。

### 叶子映射子集

| RuntimeType | TypeName / 字面量（例） | record-type 收值 | serialize（unsafe-only） |
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

### 目标

契约 × Handling × 全部内置数值族；数组 / 嵌套 object。对照 C# `FillObjectMembers` + `TypedValueContext`。

### 覆盖矩阵（反序列化）

| 类型 | 契约 bigint | 契约 number | 契约 decimal | 无契约 |
| --- | --- | --- | --- | --- |
| UInt8/Int16/Int32 | 按策略* | → number | — | 阶段 1 |
| Int64 | → bigint | → number（安全）或报错* | — | 阶段 1 |
| Float32/Float64 | — | → number | — | 阶段 1 |
| Decimal128 | — | — | → Decimal | 阶段 1 |
| BigInt | → bigint | — | — | 阶段 1 |
| 裸 number | → bigint（整数）* | → number | — | 现状 |

\* 严格/宽松策略实现时写入附录并测边界。

### 序列化（RuntimeType → TypeName / 字面量）

| RuntimeType | unsafe-only | all | none | object-type-property |
| --- | --- | --- | --- | --- |
| bigint | 超范围才装箱 | 尽量写类型名 | 尽量裸 | ObjectType 内 ≈ all |
| number | 裸 | 可选包装 | 裸 | 同上 |
| decimal | 安全/精度策略 | Decimal128 | 尽量裸 | 同上 |

### 结构遍历

| 结构 | 行为 |
| --- | --- |
| `array(element)` / 多维 | 递归 element schema |
| 嵌套 object | 递归字段；子 VO 不必都 registerType |
| 已 register 嵌套类型 | 可写成 ObjectTypeInstance `Address({…})` |

### Handling 完整语义

| 选项 | 2.2 行为 |
| --- | --- |
| deserialize `record-type` | **取消降级** |
| deserialize / serialize `object-type-property` | ObjectType 内 ≈ all；外 ≈ native / unsafe-only |
| deserialize `native` | 全拆箱，**忽略**契约 |
| deserialize `all` | 保留包装；schema 校验可选 |

### 可选（2.2b / P2）

字段级类型名 override、Valibot brand、反序列化后 `parse` 校验、多维压力测。  
**P1：** 一维/二维数组、嵌套 plain object、全 Numbers + BigInt + Decimal。

### 任务清单

| # | 任务 |
| --- | --- |
| 2.2.1 | adapter：array 嵌套、optional/nullable |
| 2.2.2 | 统一 `mapTypeInstanceToRuntime` / `mapRuntimeToTypeInstance` 全数值族 |
| 2.2.3–4 | Visitor / Generator 递归契约 |
| 2.2.5 | 接通 `object-type-property` |
| 2.2.6 | 全类型单测 + 交叉抽样 |
| 2.2.7 | type-system / README |

### 测试矩阵（2.1 时 skip，2.2 解锁）

| 编号 | 场景 |
| --- | --- |
| S10 | `bigint[]` |
| S11 | `number[][]` |
| S12 | 嵌套 object 内 Int64→bigint |
| S13 | UInt8…Decimal128 × record-type |
| S14–S15 | object-type-property ser/de |
| S16 | 契约 number 收到 Int64 边界 |
| S17 | 无 metadata / 无 adapter 回归阶段 1 |

### DoD

- [ ] 有/无契约行为表完整且有测  
- [ ] 数组与嵌套 walk 正确  
- [ ] `record-type` / `object-type-property` 不再降级  
- [ ] 映射与设计 §4.3 一致  
- [ ] S10–S17 全部真实断言  
- [ ] 无第二套 TASON 字段 DSL  

---

## 相关链接

- 上一阶段：[phase-1-number-handling.md](./phase-1-number-handling.md)  
- 下一阶段：[phase-3-duck-types.md](./phase-3-duck-types.md)  
- 总进度：[implementation-plan.md](./implementation-plan.md)  
