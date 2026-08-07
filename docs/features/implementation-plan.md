# 实施方案：数值 · 运行时契约 · 鸭子类型

设计见 [runtime-type-design.md](./runtime-type-design.md)。  
JS 选项字符串一律 **kebab-case**。

---

## 1. 目标与范围

### 1.1 目标

1. 数值：序列化 / 反序列化 `*NumberHandling` 选项拆分，并完成**不依赖类成员字段**的数值处理。  
2. ClassMetadata = **现成库的运行时 schema**（接口协定）+ 运行时→线格式薄映射。  
3. 鸭子类型 + 多态反序列化（`registerDuckType` / `parseAs`）。

### 1.2 范围内

| 模块 | 交付物 |
| --- | --- |
| 数值 | 双 Handling；serialize 含 `none`，deserialize 无 `none` |
| 运行时契约 | `schema` + `RuntimeSchemaAdapter` + **一个**官方轻量适配 |
| 映射 | bigint / number / Decimal… ↔ 默认线格式 |
| 鸭子 / 多态 | `registerDuckType`、`parseAs`、选型 |

### 1.3 范围外

自研 TASON 名挂载树作主 API、ExtraMember、命名约定、多库全适配、Zod 强绑 core、bson 官方依赖、Writer/HTTP。

### 1.4 三阶段总览

| 阶段 | 名称 | 核心交付 | 依赖 |
| --- | --- | --- | --- |
| **1** | 数值双选项（无字段上下文） | `serializeNumberHandling` / `deserializeNumberHandling`；值级拆箱/写出 | 无 |
| **2** | Class 元数据 + schema 库 | 选库 → adapter → 契约 walk → 完整数值映射 | 阶段 1 |
| **2.1** | schema 定义与简单应用 | 注册 schema、叶子字段映射、`record-type` 起步 | 阶段 1 |
| **2.2** | 全数值类型处理 | 数组/嵌套/包装/override、Handling 与契约咬合 | 阶段 2.1 |
| **3** | 鸭子类型与多态 | 多实现注册、stringify/`parseAs` 选型 | 阶段 2 |

```
Phase 1 ──► Phase 2.1 ──► Phase 2.2 ──► Phase 3
 选项+值级数值     schema 骨架       契约×数值全量      鸭子/多态
```

---

## 2. 目标 API（终态）

### 2.1 数值选项

```ts
type SerializeNumberHandling =
  | "unsafe-only" | "all" | "object-type-property" | "none";  // 默认 unsafe-only

type DeserializeNumberHandling =
  | "native" | "all" | "record-type" | "object-type-property";  // 默认 record-type；无 none

interface TASONSerializerOptions {
  serializeNumberHandling?: SerializeNumberHandling;
  deserializeNumberHandling?: DeserializeNumberHandling;
  // …既有选项
}
```

### 2.2 ClassMetadata = 运行时 schema（现成库）

```ts
interface TasonClassMetadata<S = unknown> {
  ctor?: abstract new (...args: any[]) => any;
  /** 运行时契约，不是 TASON 类型名表 */
  schema: S;
}

interface RuntimeSchemaAdapter<S = unknown> {
  /** 最小：按路径给出运行时种类，供 ser/de 映射 */
  // getRuntimeKind(schema, path): "bigint" | "number" | "string" | "boolean" | "array" | "object" | …
  // walkObjectFields / getArrayElementSchema …
}

registerType(name, typeInfo, metadata?: TasonClassMetadata): void
registerDuckType(name, typeInfo): void
```

### 2.3 Serializer

```ts
parse(text): T
/** 期望类型：ctor | 类型名 | array 描述；用于数值约束与鸭子选型 */
parseAs(expected, text): T
stringify(value, indent?): string
```

---

## 3. 行为规格摘要

### 3.1 数值 Handling

| 序列化 | 行为 |
| --- | --- |
| `unsafe-only`（默认） | **仅当数值超出安全范围时才装箱**；安全范围内尽量裸字面量 |
| `all` | 可识别数值实现尽量装箱（TypeName） |
| `object-type-property` | 对 **ObjectTypeInstance** ≈ `all`；其它 ≈ `unsafe-only` |
| `none` | 尽量裸字面量（可能写出超出 double 安全范围的字面量） |

| 反序列化 | 行为 |
| --- | --- |
| `native` | 全拆箱：`number` / `bigint`；`Decimal128` → `Decimal` |
| `all` | 保留包装类（旧版默认逻辑） |
| `record-type`（默认） | 尽量**记录**数值类型（数组 / ObjectTypeInstance），便于再序列化还原；收值后按 `native` 拆箱。有 schema 时按契约种类收值 |
| `object-type-property` | 对 **ObjectTypeInstance** ≈ `all`；其它 ≈ `native` |

拆箱约定：小整数/浮点 → `number`，Int64 → `bigint`，Decimal128 → `Decimal`。

### 3.2 运行时契约（阶段 2）

| 运行时契约 | 反序列化目标 | 序列化默认 |
| --- | --- | --- |
| `bigint` | bigint | Int64 / BigInt（随 Handling） |
| `number` | number | 裸字面量（**不**默认恢复 Int32） |
| decimal 约定 | Decimal | Decimal128 |
| string / bool | 字面量 | 字面量 |
| object / array | 递归 | 递归 |

需要线格式 Int32 等细位宽时：字段级 override / brand / `deserialize: "all"`——不自研整棵 TASON 类型树。

### 3.3 鸭子 / 期望类型（阶段 3）

- `registerDuckType` 追加实现；`types[0]` 为自动 parse 默认  
- stringify：`instanceof` 含鸭子实现  
- `parseAs` / 属性 expected：在同名多实现中选可赋值 ctor  
- 多态：首版 class 原型链即可  

---

## 4. 代码落点（总表）

| 区域 | 文件 / 目录 | 阶段 |
| --- | --- | --- |
| 选项类型与默认值 | `TasonSerializerOptions.ts`、`TASONSerializer.ts` | 1 |
| 数值拆箱 / 写出策略 | `src/types/NumberHandling.ts` | 1 |
| 反序列化应用 | `TASONVisitor.ts`（TypeInstance 出口） | 1 → 2.2 |
| 序列化应用 | `TASONGenerator.ts`（bigint / 包装 / TypeInstance） | 1 → 2.2 |
| 数值包装类型 | `types/numbers.ts`（既有；阶段 1 消费） | 1 |
| Adapter 接口 | `src/schema/RuntimeSchemaAdapter.ts` | 2.1 |
| 官方 adapter | `src/schema/adapters/valibot.ts`（选定后） | 2.1 |
| 元数据挂载 | `types/metadata.ts`、`TASONTypeRegistry.ts` | 2.1 |
| 契约 walk 与映射 | `src/schema/mapRuntimeToWire.ts` 等 | 2.1 → 2.2 |
| 鸭子注册 | `TASONTypeRegistry.ts` | 3 |
| parseAs | `TASONSerializer.ts` | 3 |
| 测试 | `test/number-handling*.test.ts`、`schema*.test.ts`、`duck*.test.ts` | 各阶段 |

---

# 阶段 1：`*NumberHandling` 选项 + 无字段上下文的数值处理

## 1.0 目标

增加序列化 / 反序列化数值选项，并在**不涉及类成员字段 / schema 上下文**的路径上实现完整数值策略。

本阶段**不**实现：

- `ClassMetadata.schema`
- 按字段契约收值 / 写出  
- `object-type-property` / `record-type` 的「实体内」语义（见下方降级）

本阶段**要**实现：

- 选项 API、默认值（反序列化类型上无 `none`）  
- 顶层与嵌套数组中的标量数值 TypeInstance 的拆箱 / 保留  
- 原生 `number` / `bigint` / 数值包装类的序列化策略  

## 1.1 选项降级语义（无契约 / 无 ObjectType 字段上下文时）

| 选项值 | 阶段 1 实际行为 |
| --- | --- |
| serialize `unsafe-only` | 包装 / bigint 在可安全表示为 number 时裸写；否则 TypeName（含超精度 Decimal） |
| serialize `all` | 包装与 bigint 写 TypeName |
| serialize `object-type-property` | **降级为 `unsafe-only`** |
| serialize `none` | **强制**所有数值为裸字面量（含超大 bigint、超精度 Decimal，永不 TypeName） |
| deserialize `native` | 全拆箱 |
| deserialize `all` | 保留包装 |
| deserialize `record-type` | **降级为 `native`**（尚不记录类型） |
| deserialize `object-type-property` | **降级为 `native`** |

> 阶段 2 接通 schema / ObjectType 上下文后，`record-type` / `object-type-property` 恢复设计语义；阶段 1 降级由测试钉死。

## 1.2 反序列化拆箱规则（值级）

在 `TASONVisitor` 创建 TypeInstance 之后、返回上层之前：

| 线格式类型名 | `native` / 降级 `record-type` / 降级 `object-type-property` | `all` |
| --- | --- | --- |
| UInt8 / Int16 / Int32 / Float32 / Float64 | → `number`（`.value`） | 保留包装实例 |
| Int64 | → `bigint`（`.value`） | 保留 `Int64` |
| BigInt | → `bigint` | → `bigint`（已是原生） |
| Decimal128 | → `Decimal`（`.value`） | 保留 `Decimal128` |
| 其它 TypeInstance | 不处理 | 不处理 |

裸数字字面量（`NumberValue`）阶段 1 **保持现状**（`Decimal`→`toNumber()`），不引入 schema。

## 1.3 序列化写出规则（值级，阶段 1 实现）

| 运行时值 | `unsafe-only` | `all` | `none` |
| --- | --- | --- | --- |
| `number`（有限） | 裸字面量 | 裸字面量 | 裸字面量 |
| `bigint` | safe → 裸 number；unsafe → `BigInt("…")` | `BigInt("…")` | **强制**十进制字面量（含超大） |
| `Int32` 等包装 | 可安全为 number 则裸，否则 TypeName | TypeName | **强制** `.value` 字面量 |
| `Decimal` / `Decimal128` | 可无损为 number 则裸，否则 TypeName | TypeName | **强制**十进制文本（含超精度） |
| 非数值 | 既有逻辑 | 既有逻辑 | 既有逻辑 |

`NaN` / `±Infinity`：保持既有行为（本阶段不扩大 scope）。

## 1.4 实现任务清单

| # | 任务 | 文件 |
| --- | --- | --- |
| 1.1 | 定义 `SerializeNumberHandling` / `DeserializeNumberHandling`（含 `native`） | `TASONSerializerOptions.ts` |
| 1.2 | 构造器默认值：`serializeNumberHandling = "unsafe-only"`，`deserializeNumberHandling = "record-type"` | `TASONSerializer.ts` |
| 1.3 | `unwrapNumberInstance` / `shouldPrefixNumberType` / resolve 降级 | `types/NumberHandling.ts` |
| 1.4 | Visitor：`createTypeInstance` 后按 deserialize 选项拆箱 | `TASONVisitor.ts` |
| 1.5 | Generator：bigint / 包装类路径读 serialize 选项 | `TASONGenerator.ts` |
| 1.6 | 导出类型（index） | `index.ts` |
| 1.7 | 测试 N1–N8 | `test/number-handling.test.ts` |

## 1.5 测试矩阵（阶段 1）

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| N1 | 默认选项 parse `Int64("1")` | `1n`（record-type → native 拆箱） |
| N2 | `deserializeNumberHandling: "all"` parse `Int64("1")` | `Int64` 实例 |
| N3 | `deserializeNumberHandling: "native"` parse `Int32("1")` | `1`（number） |
| N4 | 默认 serialize `unsafe-only`；stringify `1n` / 超大 bigint | `"1"` / `BigInt("…")` |
| N5 | `serializeNumberHandling: "none"` 全部数值含超大 bigint/Decimal | 强制裸字面量 |
| N7 | 嵌套数组 `[[Int64("1")]]` + 默认 deserialize | `[[1n]]` |
| N8 | `object-type-property` 序列化 / 反序列化 | 分别降级为 unsafe-only / native |

## 1.6 阶段 1 DoD

- [x] 双选项进入公开 API，默认值正确  
- [x] 无 schema 时拆箱/写出行为符合 §1.2–1.3  
- [x] `object-type-property` / `record-type` 降级有测试钉死  
- [x] 既有 parse/stringify 测试已按默认拆箱更新  
- [x] **不**引入 schema 库依赖  

---

# 阶段 2：Class 元数据 + 选定 schema 库

## 2.0 目标与分步

实现 **ClassMetadata = 现成库运行时类型** 作为接口协定，经 adapter 映射到线格式。  
拆成两步，避免「库 + 全数值 + 嵌套」一次过大。

| 子阶段 | 焦点 | 不做 |
| --- | --- | --- |
| **2.1** | 选库、adapter 骨架、注册 schema、**简单叶子字段**应用 | 多维数组完备、字段 override、object-type-property 全语义 |
| **2.2** | **全部**内置数值类型 + 数组/嵌套 + Handling 与契约完整咬合 | 鸭子选型（留给阶段 3） |

---

## 阶段 2.1：schema 定义与简单应用

### 2.1.1 选型原则（官方 peer 只选一个）

| 维度 | 要求 |
| --- | --- |
| 重量 | 树摇友好、依赖少 |
| 运行时 | 可 introspect 字段与叶子种类（不只 validate） |
| TS | 从 schema 推断静态类型（加分） |
| 表达 | object / array / bigint / number / string / boolean / 嵌套 |
| 绑定 | **peerDependency**；core 只依赖 adapter 接口 |

**推荐：Valibot**（首选）

| 候选 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| **Valibot** | 轻、模块化、有标准 schema 结构可 walk | 生态小于 Zod | **官方默认 adapter** |
| TypeBox | JSON Schema 同源、快 | 偏 JSON 类型，bigint 需扩展 | 备选 / 社区 adapter |
| Zod | 生态最大 | 体积与 introspect 成本较高 | 不绑 core；可后续社区适配 |

实施 2.1 开篇任务：**锁定 Valibot 主版本**，写入 `peerDependencies` + `peerDependenciesMeta.optional`，devDependency 供测试。

### 2.1.2 Adapter 最小接口（2.1 冻结草案）

```ts
/** 运行时种类：粗于 TASON 线类型，供映射表使用 */
type RuntimeKind =
  | "bigint" | "number" | "string" | "boolean"
  | "decimal"   // 约定：Decimal / decimal.js
  | "object" | "array" | "unknown";

interface RuntimeSchemaAdapter<S = unknown> {
  /** 是否为本 adapter 可识别的 schema */
  isSchema(value: unknown): value is S;

  /** object schema 的字段名 → 子 schema */
  objectEntries(schema: S): Iterable<[string, S]> | null;

  /** array schema 的元素 schema */
  arrayElement(schema: S): S | null;

  /** 叶子或包装后的运行时种类 */
  runtimeKind(schema: S): RuntimeKind;
}
```

2.1 只要求：`object` + 叶子 `bigint|number|string|boolean`；`array` 可先支持一维。

### 2.1.3 元数据挂载

```ts
// 扩展 registerType
registerType(name, typeInfo, metadata?: { schema?: unknown }): void

// Registry 存储
// entry 或 typeInfo 旁路：Map<typeName, schema> 或 TasonClassMetadata
```

- `schema` 描述 **JS 运行时形状**，不是 `Int64` 字段表  
- Serializer / Registry 持有全局 `RuntimeSchemaAdapter`（构造可选注入；默认 Valibot adapter）  

示例（文档用，非强制 API 形状）：

```ts
import * as v from "valibot";

const UserSchema = v.object({
  id: v.bigint(),
  name: v.string(),
  age: v.number(),
});

registry.registerType("User", { kind: "object", ctor: User }, { schema: UserSchema });
```

### 2.1.4 简单应用路径

**反序列化 `record-type`（有 schema 时）：**

1. 解析出 `User({ id: Int64("1"), name: "a", age: 18 })`  
2. 用 adapter 取字段 `id` → kind `bigint` → 将 `Int64` 实例拆为 `1n`  
3. `age` → `number` → `Int32`/`裸 number` → number  
4. 再 `createInstance` 赋给 ctor  

**序列化（有 schema 时）：**

1. 识别实例为 User（既有 tryGetTypeInfo）  
2. walk schema 字段：`id` 为 bigint → 按 serialize Handling 写 `Int64`/`BigInt`  
3. `age` 为 number → 裸写  

**无 schema：** 行为 = 阶段 1（不回归）。

### 2.1.5 任务清单（2.1）

| # | 任务 | 说明 |
| --- | --- | --- |
| 2.1.1 | 锁定 Valibot 版本；peer + devDep | package.json |
| 2.1.2 | `RuntimeSchemaAdapter` + `RuntimeKind` | `src/schema/` |
| 2.1.3 | `createValibotAdapter()` | 支持 object / 叶子 / 一维 array |
| 2.1.4 | Registry：`registerType` 第三参 metadata；`getSchema(name)` | |
| 2.1.5 | Serializer 可注入 adapter | 选项或构造 |
| 2.1.6 | Visitor：object 类型实例 + `record-type` 时按 schema 收叶子数值 | 仅 object 字段 |
| 2.1.7 | Generator：object 序列化时按 schema 写叶子数值 | |
| 2.1.8 | 测试 S1–S4 | |

### 2.1.6 测试矩阵（2.1）

| 编号 | 场景 | 期望 |
| --- | --- | --- |
| S1 | schema `id: bigint`，parse `User({id:Int64("1")})` + record-type | `user.id === 1n` |
| S2 | schema `age: number`，parse `User({age:Int32("18")})` + record-type | `user.age === 18` |
| S3 | 无 schema 的类型 | 与阶段 1 一致 |
| S4 | stringify 带 schema 的 User（id bigint） | 按 serialize Handling 写线格式 |
| S5 | adapter 无法识别的 schema | 明确报错或忽略契约（实现时定一种） |

### 2.1.7 阶段 2.1 DoD

- [ ] 官方 adapter（Valibot）可 walk object 叶子  
- [ ] `registerType(..., { schema })` 可用  
- [ ] `record-type` 在**简单 object 叶子**上按契约收值  
- [ ] 无 schema 路径零回归  
- [ ] 文档示例与 peer 安装说明  

---

## 阶段 2.2：完整实现所有数值类型的处理

### 2.2.1 目标

在 2.1 骨架上，把**契约 × Handling × 全部内置数值族**做完，并覆盖数组 / 嵌套 object。

### 2.2.2 覆盖矩阵

**线格式类型（反序列化入口）：**

| 类型 | 契约 bigint | 契约 number | 契约 decimal | 无契约 |
| --- | --- | --- | --- | --- |
| UInt8/Int16/Int32 | 按策略* | → number | — | 阶段 1 |
| Int64 | → bigint | → number（若安全）或报错* | — | 阶段 1 |
| Float32/Float64 | — | → number | — | 阶段 1 |
| Decimal128 | — | — | → Decimal | 阶段 1 |
| BigInt | → bigint | — | — | 阶段 1 |
| 裸 number | → bigint（若整数）* | → number | — | 现状 |

\* 标 * 项：实现时定严格/宽松策略，写入设计附录并测边界（如 Int64→number 超出安全整数）。

**序列化（契约 → 默认线类型）：**

| 契约 kind | unsafe-only | all | none | object-type-property |
| --- | --- | --- | --- | --- |
| bigint | 超范围才装箱 / 否则裸 | 尽量 TypeName | 尽量裸 | ObjectType 内 ≈ all |
| number | 裸 | 可选包装 | 裸 | 同上 |
| decimal | 按安全/精度策略 | Decimal128 | 尽量裸 | ObjectType 内 ≈ all |

### 2.2.3 结构遍历

| 结构 | 行为 |
| --- | --- |
| `array(element)` | 每个元素按 element schema 映射 |
| `array(array(...))` | 递归 element |
| 嵌套 `object` | 递归字段；**不必**子 object 都 registerType |
| 已 register 的嵌套类型名 | 线格式可写 `Address({…})`；schema 仍描述运行时 |

### 2.2.4 Handling 完整语义（接通契约）

| 选项 | 阶段 2.2 行为 |
| --- | --- |
| deserialize `record-type` | **取消降级**：记录类型 + 按 schema / `native` 收值 |
| deserialize `object-type-property` | ObjectTypeInstance 内 ≈ all；其它 ≈ native |
| serialize `object-type-property` | ObjectTypeInstance 内 ≈ all；其它 ≈ unsafe-only |
| deserialize `native` | 仍全拆箱，**忽略** schema 种类（契约不参与收值） |
| deserialize `all` | 保留包装；schema 可用于结构校验（可选，非必须） |

### 2.2.5 可选薄能力（2.2 内若时间紧可标为 2.2b）

| 能力 | 说明 | 优先级 |
| --- | --- | --- |
| 字段 wire override | `metadata.wireTypes?: Record<path, "Int32">` | P2 |
| Valibot brand / metadata | 表达「这是 Int32 位宽」 | P2 |
| 反序列化后 `schema` 校验 | 调用库 `parse` 校验形状 | P2 |
| 多维数组压力测 | 大矩阵 | P3 |

P1 必须：一维/二维数组数值元素、嵌套 plain object、全部 Numbers + BigInt + Decimal 路径。

### 2.2.6 任务清单（2.2）

| # | 任务 |
| --- | --- |
| 2.2.1 | adapter：完善 array 嵌套、optional/nullable（若库支持且需要） |
| 2.2.2 | 统一 `mapWireToRuntime(kind, value, handling)` / `mapRuntimeToWire(kind, value, handling)` |
| 2.2.3 | Visitor：递归 object/array 契约路径 |
| 2.2.4 | Generator：递归按契约写出 |
| 2.2.5 | 接通 `object-type-property` 真实语义 |
| 2.2.6 | 全部数值类型单测 + 交叉矩阵抽样 |
| 2.2.7 | 更新 type-system / README 用户可见说明 |

### 2.2.7 测试矩阵（2.2）

| 编号 | 场景 |
| --- | --- |
| S10 | `bigint[]`：parse 数组元素全为 bigint |
| S11 | `number[][]`：二维 number |
| S12 | 嵌套 object 内 Int64→bigint |
| S13 | 全类型表：UInt8…Decimal128 × record-type |
| S14 | serialize object-type-property vs unsafe-only / all 差异用例 |
| S15 | deserialize object-type-property：ObjectType 内包装 / 外 native 拆箱 |
| S16 | record-type 下契约 number 收到 Int64 的边界策略 |
| S17 | 无 schema 回归阶段 1 全套 |

### 2.2.8 阶段 2.2 DoD

- [ ] 内置数值类型在「有 schema / 无 schema」下行为表完整且有测  
- [ ] 数组与嵌套 object 契约 walk 正确  
- [ ] `record-type` / `object-type-property` 不再降级  
- [ ] 映射表与设计文档 §4.3 一致  
- [ ] 不引入第二套 TASON 字段类型 DSL  

---

# 阶段 3：鸭子类型与多态反序列化

## 3.0 目标

同名多实现注册、序列化选型、反序列化在期望类型下选型；与阶段 2 的 schema 层正交。

## 3.1 API

```ts
// 追加实现；不替换 types[0]
registerDuckType(name: string, typeInfo: TASONTypeInfo<T>): void

// 期望类型引导：ctor | 已注册类型名 | 其它描述（实现时定）
parseAs<T>(expected: Constructor<T> | string, text: string): T
```

既有能力复用：

- `types: TASONTypeInfo[]` 已是数组（`registerType` push）  
- `getType(name, obj)` 已按 `instanceof` 找实现  
- `getDefaultType` = `types[0]`  
- `TASONTypeDiscriminator` 已存在——阶段 3 对齐文档，补测即可  

## 3.2 行为

| 场景 | 行为 |
| --- | --- |
| parse 无 expected | 用 `getDefaultType`（types[0]） |
| parseAs(User, text) | 解析后若为 object 类型，优先匹配 User 可赋值实现；数值鸭子按 ctor 选 |
| stringify 鸭子实例 | `tryGetTypeInfo` 已能 `instanceof` 命中后注册的实现 |
| FakeLong 注册为 Int64 鸭子 | stringify → `Int64("…")`；parse 默认仍官方 Int64，除非 parseAs(FakeLong) |
| 多态子类 | 原型链 / discriminator；首版不要求接口注册表 |

## 3.3 与 schema 的关系

- schema 描述**运行时种类**（bigint），不描述「用哪个鸭子类」  
- 鸭子解决**同一线类型名**的多 JS 实现  
- `parseAs` 可同时：按 schema 收值 + 按 ctor 选实现  

## 3.4 任务清单

| # | 任务 |
| --- | --- |
| 3.1 | `registerDuckType` 语义明确（alias of push + 文档；或校验 name 已存在） |
| 3.2 | `parseAs` 实现：parse 管线 + expected 选型 |
| 3.3 | Visitor/createInstance：支持指定 typeInfo 而非仅 default |
| 3.4 | 与 discriminator 行为对齐测试 |
| 3.5 | 示例：Int64 默认 + FakeLong 鸭子 |
| 3.6 | 文档与 CHANGELOG |

## 3.5 测试矩阵（阶段 3）

| 编号 | 场景 |
| --- | --- |
| D1 | registerDuckType 后 stringify 鸭子实例得到正确 TypeName |
| D2 | parse 默认仍 types[0] |
| D3 | parseAs(FakeLong, `Int64("1")`) 得到 FakeLong |
| D4 | parseAs(User) + schema 契约收值同时生效 |
| D5 | 子类 / discriminator 多态一轮 |

## 3.6 阶段 3 DoD

- [ ] `registerDuckType` + `parseAs` 公开可用  
- [ ] 默认 parse 不破坏既有默认实现  
- [ ] 与 schema 数值路径无冲突  
- [ ] 文档示例完整  

---

## 5. 跨阶段固定决策

| 项 | 决策 |
| --- | --- |
| ClassMetadata | 运行时 schema（现成库）+ adapter，非 TASON 名表 |
| 官方库 | **Valibot**（2.1 锁定版本；可复议一次） |
| ExtraMember / naming | **不迁** |
| 默认 Handling | serialize `unsafe-only`；deserialize `record-type` |
| 反序列化全拆箱名 | **`native`**（不用 unsafe-only） |
| none | 仅序列化 |
| number→Int32 | 默认不恢复；override/brand/`all` |
| 多余字段 | 原生对象行为，不建模 |
| 选项命名 | kebab-case 字符串字面量 |

---

## 6. 建议排期与依赖

| 阶段 | 预估相对工作量 | 阻塞项 |
| --- | --- | --- |
| 1 | M | 无 |
| 2.1 | M | 阶段 1；Valibot 版本确认 |
| 2.2 | L | 阶段 2.1 |
| 3 | S–M | 阶段 2.2（parseAs 可与 2.2 末期并行，但 D4 依赖 schema） |

推荐合并策略：

- PR1 = 阶段 1  
- PR2 = 阶段 2.1  
- PR3 = 阶段 2.2  
- PR4 = 阶段 3  

---

## 7. 总 DoD

- [ ] 阶段 1–3 各自 DoD 勾选  
- [ ] 测试绿；公开 API 不以自研 TASON 类型树为主  
- [ ] 与 [runtime-type-design.md](./runtime-type-design.md) 一致  
- [ ] CHANGELOG 记录行为变更（尤其默认 deserialize 拆箱）  
- [ ] README / type-system 链到本方案  

---

## 8. 文档索引

| 文档 | 职责 |
| --- | --- |
| [runtime-type-design.md](./runtime-type-design.md) | 设计（含元数据迁/不迁、映射表） |
| [implementation-plan.md](./implementation-plan.md) | 本方案（三阶段实施） |
| [type-system.md](../type-system.md) | 规范 |
| [regexp.md](../regexp.md) | 正则 |
