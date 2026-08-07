# JS 运行时类型设计

设计背景（数值、实体元数据、鸭子类型/多态）。  
落地步骤见 [implementation-plan.md](./implementation-plan.md)；规范见 [type-system.md](../type-system.md)。

JS 侧选项字符串一律 **kebab-case**。

---

## 1. 问题与边界

| 难点 | 说明 |
| --- | --- |
| 无定长数值原语 | 仅 `number` / `bigint` |
| 动态结构 | 无 schema 时类型在值上或旁路 |
| 实体 / 接口协定 | 需要**运行时形状**（嵌套、数组元素是 bigint 还是 number） |
| 线格式位宽 | TASON 有 Int32/Int64/…，比 JS 运行时类型更细 |
| 多实现同名 | 包装类 / bigint / 未来 bson.Long |

**本轮做**：数值 Handling 拆分；**ClassMetadata = 现成库的运行时契约** + 映射到线格式；鸭子类型。  
**本轮不做**：自研 TASON 名挂载 DSL 当主 API、ExtraMember、命名约定、多 schema 库全量适配。

---

## 2. 双路径与两层模型

```
  应用接口协定（运行时）          线格式（TASON 文本）
  ┌─────────────────────┐       ┌──────────────────────┐
  │ 现成 schema 库       │       │ TypeRegistry 类型名   │
  │ bigint / number[][] │ 映射  │ Int64 / 裸 number    │
  │ 嵌套 object …       │ ←──→  │ User({…}) / 数组     │
  └─────────────────────┘       └──────────────────────┘
         ClassMetadata                    Handling + 默认映射表
```

| | 路径 A 动态 | 路径 B 实体 |
| --- | --- | --- |
| 契约 | 无 | schema 库描述运行时形状 |
| 值 | number / bigint / Decimal | 同左（与契约一致） |
| 线类型 | Handling + 值推断 | 契约→线映射 + Handling |

---

## 3. 数值：序列化 / 反序列化选项拆分

精度陷阱主要在反序列化；序列化可保留 `none`，反序列化**无** `none`。

```ts
type SerializeNumberHandling =
  | "unsafe-only" | "all" | "object-type-property" | "none";  // 默认 unsafe-only

type DeserializeNumberHandling =
  | "native" | "all" | "record-type" | "object-type-property"; // 默认 record-type
```

| 序列化 | 行为 |
| --- | --- |
| `unsafe-only`（默认） | **仅当数值超出安全范围时才装箱**（TypeName）；安全范围内尽量裸字面量 |
| `all` | 可识别数值实现尽量装箱 |
| `object-type-property` | 对 **ObjectTypeInstance** 相当于 `all`；其它相当于 `unsafe-only` |
| `none` | **强制**所有数值为裸字面量（含超大 bigint / 超精度 Decimal，永不 TypeName） |

| 反序列化 | 行为 |
| --- | --- |
| `native` | **全拆箱**：原生 `number` / `bigint`；`Decimal128` → `Decimal` |
| `all` | 保留包装类（旧版默认逻辑） |
| `record-type`（默认） | 尽可能**记录**数值类型（主要针对数组与 ObjectTypeInstance），便于再序列化还原；收值路径上再按 `native` 拆箱。有 schema 时按契约种类收值 |
| `object-type-property` | 对 **ObjectTypeInstance** 相当于 `all`；其它相当于 `native` |

拆箱约定：小整数/浮点 → `number`，Int64 → `bigint`，Decimal128 → `Decimal`。

> 阶段 1（无 schema / 无 ObjectType 字段上下文）时：`record-type` 与 `object-type-property` 在反序列化上**降级为 `native`**；序列化 `object-type-property` **降级为 `unsafe-only`**。完整语义见阶段 2。
---

## 4. 实体元数据：运行时契约（现成库），不是 TASON 类型表

### 4.0 早期意图

ClassMetadata 应用**现成轻量库的类型**表达 **JS 运行时类型**，作**接口协定**；  
不是再描述 TASON 声明类型（那是 Registry 的职责）。

| 层 | 问题 | 载体 |
| --- | --- | --- |
| 运行时契约 | 字段是 bigint 还是 number？`T[]`？嵌套对象？ | Zod / TypeBox / Valibot … |
| TASON 线格式 | 写 `Int64("…")` 还是裸 `1`？ | Registry + Handling |
| 映射 | 运行时种类 → 默认线类型 | 约定表 + 可选字段 override |

### 4.1 为何不自研「字段 → Int64」树

那会变成**第二套类型描述 + 解析**，和 schema 库重复，还和 TS 推断脱节。  
真正缺的是：

1. 运行时形状与元素种类（库已擅长）  
2. 与线格式的**映射**（TASON 独有、应很薄）

### 4.2 概念 API

```ts
interface TasonClassMetadata<S = unknown> {
  ctor?: abstract new (...args: any[]) => any;
  /** 运行时契约，不是 TASON 类型名表 */
  schema: S;
}

// 示例（具体库由 adapter 决定）
const UserSchema = object({
  id: bigint(),
  ids: array(bigint()),
  matrix: array(array(number())),  // number[][]
  profile: object({ age: number(), name: string() }),
});

registerType("User", { kind: "object", ctor: User }, { schema: UserSchema });
```

- 嵌套 VO：schema 内 `object({…})`，**不必**每个都 register（除非要线格式 `Address({…})`）  
- 多维数组：库的 `array(array(…))`，不自研 `Int32[][]` DSL  
- 结构 walk/校验：库自带；TASON 只在叶子做数值映射  

### 4.3 运行时 → 线格式默认映射

JS 种类**粗于** TASON 数值族，必须承认默认映射：

| 运行时契约 | 反序列化目标 | 序列化默认 |
| --- | --- | --- |
| `bigint` | bigint | Int64 / BigInt（Handling） |
| `number` | number | 裸字面量（**不**默认恢复 Int32） |
| decimal 约定 | Decimal | Decimal128 |
| string / bool | 字面量 | 字面量 |
| object / array | 递归 | 递归 |

**需要线格式 Int32 位宽时**（少数）：字段级 override、库 brand/metadata、或 `deserialize: "all"` + 包装/鸭子——**不要**为此重做整棵 TASON 类型树。

### 4.4 `record-type` 在本模型下

- 目标：反序列化时尽量**记下**线格式数值类型信息（尤其数组元素、ObjectType 字段），以便 `stringify` 时写回对应 TypeName；应用层取值仍走 `native` 语义（拆箱为 number/bigint/Decimal）  
- 有 schema 时：按 **schema 期望的运行时种类**收值（`Int64("1")` + 契约 bigint → `1n`）  
- 数组/嵌套按 schema 遍历，保证 `bigint[]` 元素真是 bigint  
- 不把观测结果写成自研 TASON 名表；契约已在 schema 里  

### 4.5 库与核心边界

| 原则 | 说明 |
| --- | --- |
| peer + adapter | 核心定义 `RuntimeSchemaAdapter`，官方适配 **一个**轻量库 |
| 候选 | **Valibot（官方默认，实施锁定）**；TypeBox / Zod 可后续社区适配 |
| 无 schema | 行为 = 现状 + 仅 Handling/鸭子 |
| 不绑死 | 用户可换 adapter，不强制唯一库 |

```ts
interface RuntimeSchemaAdapter<S = unknown> {
  /** 提供字段路径上的运行时种类，供 ser/de 映射 */
  // 最小能力：遍历实体属性、识别 bigint|number|array|object|string|boolean|…
}
```

### 4.6 本轮迁 / 不迁

| 迁 | 不迁 |
| --- | --- |
| NumberHandling 双选项 | 自研 TASON 名挂载树作主 API |
| 鸭子类型 | ExtraMember / 命名约定 |
| ClassMetadata.schema + 一个 adapter | 多库全适配 |
| 默认运行时↔线映射 | 完整 brand/Int32 体系（可薄做） |

---

## 5. 鸭子类型与多态

```ts
registerType("Int64", defaultInfo);
registerDuckType("Int64", bsonLongInfo);
```

线格式多实现；与 schema 层正交。`parseAs` 可按 ctor/schema 期望选型。

---

## 6. 咬合

```
parse / parseAs(User)
  → deserializeNumberHandling
  → 有 schema：按运行时契约收值（record-type）
  → 映射：TypeInstance → bigint/number/…

stringify(user)
  → 有 schema：按契约种类 + Handling 写线格式
  → 否则：鸭子/包装/Handling
```

---

## 7. 实施阶段（摘要）

细节、任务清单与测试矩阵见 [implementation-plan.md](./implementation-plan.md)。

| 阶段 | 内容 |
| --- | --- |
| **1** | `*NumberHandling` 双选项；**不涉及类成员字段**的值级拆箱/写出；`record-type` / `object-type-property` 暂降级 |
| **2.1** | 选定 **Valibot**；`RuntimeSchemaAdapter`；schema 注册 + 简单 object 叶子应用 |
| **2.2** | 全部内置数值 × 契约 × 数组/嵌套；Handling 完整语义 |
| **3** | `registerDuckType`、`parseAs`、多态选型 |

---

## 8. 决议摘要

1. 数值读写选项拆分；反序列化用 `native` 表示全拆箱（无 `none`）。  
2. **ClassMetadata = 运行时契约（现成 schema 库）**，作接口协定。  
3. **Registry + Handling = 线格式**；中间只有**薄映射**。  
4. 嵌套/多维数组交给 schema 库，不自研类型 DSL。  
5. `number` 默认不恢复 Int32；细线类型用 override/brand/`all`。  
6. 核心 adapter 接口 + 一个官方轻量实现（**Valibot**）。  
7. 鸭子类型仍在 Registry 层。  
