# Phase 4：统一数值实现协议（`unwrapNumber`）

> 状态：**设计定稿，未实施**。进度：[implementation-plan.md](./implementation-plan.md)  
> 用语：[glossary.md](../glossary.md)。相关：[phase-1-number-handling.md](./phase-1-number-handling.md)（Handling 选项）· [phase-3-duck-types.md](./phase-3-duck-types.md)（多实现 / `parseAs`）  
> 首个应用方：[tason-mongodb](../monorepo/phase-c-bson-types.md)（行为差异表见该文 §6）

---

## 1. 目标

**内置数值实现与第三方可替换实现走同一契约、同一逻辑。**

- JS 的 Int64 / Decimal 第三方实现众多（`bson` / `long.js` / `big.js` / `bignumber.js` …），任何一方挂到数值 TypeName 下都**无需改动核心**即获得完整 Number Handling 行为。
- 同一数值 TypeName 下允许多种实现（不止两种）共存，且 ser / de 行为一致。
- 消除核心对内置数值包装的特权路径（单轨化）。

## 2. 现状（双轨）

Handling 的**作用域判定**已按 TypeName（Generator 命中数值 TypeName 后介入，`isNumberTypeName`），但拆箱 / 字面量化是**双轨**的，且只有其中一轨：

| 轨道 | 判断 | 覆盖 |
| --- | --- | --- |
| 内置 | `isNumberWrapper`（`NUMBER_WRAPPER_CTORS` instanceof 白名单）→ `INumber.value` | 仅 8 个内置包装类 |
| 第三方 | **不存在** | bson 等外部数值类完全不参与 Handling |

`isNumberWrapper` 调用点（单轨化时全部迁移）：

| 路径 | 位置 | 处数 |
| --- | --- | --- |
| 值级 de | `TASONVisitor.finishInstance` → `unwrapNumberInstance` | 1 |
| 值级 ser | `TASONGenerator` 数值 TypeName 分支 → `trySerializeNumberAsSafeNumberLiteral` / `trySerializeNumberAsLiteral` | 2 |
| 契约 de | `schema/mapTypeInstanceToRuntime.ts`（`toBigInt` / `toNumber` / `toDecimal`） | 3 |
| 契约 ser | `schema/mapRuntimeToTypeInstance.ts` | 3 |

外部数值类不参与 Handling 的直接后果（`tason-mongodb` 视角，差异表见其 §6）：ser `unsafe-only` 下安全整数也装箱、`none` 抛错；`replaceDefaultImplementation` 置顶 bson 实现后，`deserializeNumberHandling: "native"` 拿到的永远是 bson 实例，**自动拆箱无法实现**。

## 3. 方案：TypeInfo 统一契约 `unwrapNumber`

核心 `TASONScalarTypeInfo` 增加字段（公开 API 变更）：

```ts
/**
 * 数值 TypeName（NUMBER_TYPE_NAMES）实现的统一契约：实例 → 原生值。
 * 返回值与核心包装 `.value` 同型：number（Int32/Float64 族）、
 * bigint（Int64/BigInt 族）、Decimal（Decimal128；decimal.js 为核心
 * 既有依赖，第三方 Decimal 库在钩子内自行转换）。
 */
unwrapNumber?: (value: T) => number | bigint | Decimal;
```

**单轨化**（消除内置特权路径）：

| 项 | 现状（双轨） | 目标（单轨） |
| --- | --- | --- |
| 内置数值实现 | `isNumberWrapper` instanceof 白名单 → `.value` | 内置 TypeInfo 同样声明钩子（包装 `v => v.value`；`BigInt` 的 `deserialize` 已产原生 `bigint`，声明恒等 `v => v`） |
| 第三方实现 | 不参与 Handling | 声明钩子即获得与内置**完全一致**的行为 |
| 核心判断 | `NUMBER_WRAPPER_CTORS.some(instanceof)` + `.value` 回退 | 只读命中 TypeInfo 的钩子；`isNumberWrapper` 特权路径删除 |

**注册校验：** `registerType` 到数值 TypeName 时缺 `unwrapNumber` → **抛错**（fail fast，防同一 TypeName 下实现行为分叉；`deserialize` 已产原生值的实现用恒等钩子，规则不破例）。

消费点（钩子是唯一入口，无 `.value` 回退）：

| 侧 | 位置 | 改动 |
| --- | --- | --- |
| de | `TASONVisitor.finishInstance` → `unwrapNumberInstance` | 传入 `typeInfo`；`native` 时执行 `typeInfo.unwrapNumber(instance)` |
| ser | `TASONGenerator` 数值 TypeName 分支 → `trySerializeNumberAs*Literal` | 字面量尝试前先用钩子归一化，再走既有 number / bigint / Decimal 字面量规则（安全 / 无损判定复用，不另造一套） |
| 契约路径 | `mapTypeInstanceToRuntime` / `mapRuntimeToTypeInstance` 的 `toBigInt` / `toNumber` / `toDecimal` | 入口先经钩子归一化到原生值，再按既有规则收敛；避免值级 / 契约级第三条分叉 |

设计要点：

1. **协议在 TypeInfo，不由第三方类作者实现**。不能指望 `bson` / `long.js` 等官方类声明 TASON 协议方法；「由扩展方给第三方原型打补丁」的变体见 §5（评估后不采用）。TypeInfo 是现成的「按 (TypeName, ctor) 声明能力」的扩展点，Visitor / Generator 调用点均已持有命中的 TypeInfo。
2. **同型约定是统一行为的关键**：钩子必须拆到「该 TypeName 核心包装 `.value` 的类型」。`Int64` 拆 `bigint` 而非 number（避免安全整数静默转 `number` 丢精度——同 glossary「安全整数不静默截断」）；`Decimal128` 拆 decimal.js `Decimal`，第三方 Decimal 库的转换责任在各自钩子内。安全 / 无损判定只对 number / bigint / Decimal 三种形态实现一份。
3. **继承基类不受影响**：如 `bson.Timestamp` 继承 `bson.Long`，Long 实现的 `match` 按 `_bsontype` 排除，钩子只在命中该实现后执行。
4. schema 契约路径的优先级语义不变（phase-2）；本方案只把其中的数值拆箱统一到钩子上。
5. 与 C# 的关系：C# 数值即 CLR 原生类型，无此问题；本协议是 JS 生态的等价能力，语义仍对齐（Handling 结果一致）。

**多实现共存示例**（`Int64` 名下三种实现，行为一致）：

| 实现（注册序） | `serialize` | `unwrapNumber` | stringify 实例 | parse `Int64("1")`（`native`） |
| --- | --- | --- | --- | --- |
| 核心 `Int64`（默认） | 十进制串 | `v => v.value` | 安全裸写 / 装箱 | `bigint` |
| `bson.Long`（tason-mongodb 追加） | 十进制串 | `v => v.toBigInt()` | 同上 | `bigint`（置顶后同样拆） |
| `long.js` `Long`（用户追加） | 十进制串 | `v => v.toBigInt()` | 同上 | `bigint`（`asDefault` 置顶后同样拆） |

## 4. 工作流：钩子跟随哪个 TypeInfo

**不变式：钩子取自「实际构造 / 命中该实例的那个 TypeInfo」，不是全局 `types[0]`。**

de（`parse('Int64("1")')`，replaceDefault 开、handling `native`）：

1. `resolveTypeInfo("Int64")` → `getDefaultType` 得 bson Long 实现（或 `parseAs(Long)` 指定）。
2. `createInstance` → 该实现的 `deserialize` 构造 `bson.Long`。
3. `unwrapNumberInstance`：`native` → 该 TypeInfo 的钩子 `Long.toBigInt()` → `bigint`。replaceDefault 关时同一文本构造核心包装（钩子 `v => v.value`）→ 同样 `bigint`。殊途同归：拆箱结果与 `types[0]` 无关。

ser（`stringify(Long.fromInt(1))`，handling `unsafe-only`）：

1. `tryGetTypeInfo` 从实例命中 `(Int64, bson Long 实现)`——按 `instanceof` ∧ `match`，与 `types[0]` 无关。
2. `isNumberTypeName("Int64")` 成立 → 进入 Handling 分支。
3. `none` / `unsafe-only`：先用命中实现的钩子归一化（`Long` → `bigint`），再走**既有** number / bigint / Decimal 安全与字面量规则（不另造 bson 分支；安全整数裸写、超范围按档位装箱 / 强制裸写）。
4. `all`（或 `unsafe-only` 下不可安全裸写）：直接 `TypeInstanceValue` 用命中实现 `serialize` 装箱为 `Int64("…")`。

## 5. 备选评估：把协议挂到第三方原型（不采用）

设想：扩展包注册时对 `bson.Long.prototype` 等以 Symbol 键 `defineProperty` 挂「数值标记 + `unwrap` 方法」，核心判 `value[KEY]` 是否为函数。评估：

- **性能不是决策因素。** 两个消费点均已持有命中的 TypeInfo，钩子读取是一次属性访问，与原型方法查找同级；ser 真正的开销是 `tryGetTypeInfo` 的双层 `instanceof` 扫描，两方案都不改变它。de 侧对未实现协议的核心包装，原型 miss 反而多走一整条原型链。
- **对第三方库自身运行无影响**：Symbol 键、不可枚举、不覆盖既有成员、幂等，`bson.serialize` / `deserialize` 只读实例自有状态。
- **风险在包边界**：双份 `bson` 时只有被打补丁那份副本的实例带标记，另一份**静默**退化为不拆箱 / 装箱（与 `instanceof` 失效同源，但没有报错线索，更难排查）；补丁常驻进程、无清理时机；`bson` 的 `.d.ts` 无法声明该方法，核心判断处需 `any` 断言。
- **结论：** 统一协议走 TypeInfo——不碰第三方原型、TS 类型可直接表达、与「TypeInfo 是扩展点」的架构一致，且内置与第三方同轨（§3 单轨化）。若将来出现**无 TypeInfo** 的鸭子数值（用户自有类直接 stringify），可把实例协议加为次级回退（钩子 → 实例协议），二者不冲突。

## 6. 首个应用：tason-mongodb

| TypeInfo | 钩子实现 |
| --- | --- |
| `Int64`（`bson.Long`） | `v.toBigInt()`（`valueOf` 会转 `number` 丢精度，禁用） |
| `Int32`（`bson.Int32`） | `v.valueOf()` |
| `Float64`（`bson.Double`） | `v.valueOf()` |
| `Decimal128`（`bson.Decimal128`） | `new Decimal(v.toString())` |

协议落地前后的行为差异表与该包的跟进任务在 [phase-c-bson-types.md §6](../monorepo/phase-c-bson-types.md)（勾选在 [monorepo implementation-plan](../monorepo/implementation-plan.md) 阶段 C4）。

## 7. 任务清单

| # | 任务 | 归属 |
| --- | --- | --- |
| 4.1 | `unwrapNumber` 契约字段；内置数值 TypeInfo 全量声明（包装 `v => v.value`、`BigInt` 恒等 `v => v`）；删除 `isNumberWrapper` / `.value` 特权路径——§2 表中 9 处调用点一并迁移到钩子归一化；数值名注册缺钩子抛错 | `packages/tason` |
| 4.2 | 测试：以「模拟第三方数值类」测多实现（≥3）共存与 ser/de 行为一致性（`number-handling.test.ts`）；既有 Handling / schema 矩阵全绿 | `packages/tason` |
| 4.3 | 文档同步：phase-1（Handling 语义补「按 TypeName 覆盖全部实现」）、本文状态、`docs/number-handling.md`、`docs/type-system.md` 多实现短节 | docs |

tason-mongodb 侧跟进（bson 钩子、M6 重写、包 README）属 monorepo feature，见其 plan 阶段 C4，不在此勾选。

**DoD：** 核心无数值特权路径；模拟第三方实现与内置行为一致（ser 三档、de `native` 拆箱 / `all` 保留）；数值名缺钩子注册抛错；既有 Handling / schema 测试全绿。
