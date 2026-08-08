# JS 运行时类型设计

设计背景（数值、实体元数据、鸭子类型/多态）。  
落地进度见 [implementation-plan.md](./implementation-plan.md)（入口）；分册：[阶段 1](./phase-1-number-handling.md) · [阶段 2](./phase-2-class-metadata-schema.md) · [阶段 3](./phase-3-duck-types.md)。规范见 [type-system.md](../../type-system.md)。

JS 侧选项字符串一律 **kebab-case**。

**来源：** 本设计自 C# 参考实现 `E:\dev\VS2022\tason-net`（核心库 `TASON/`：`Metadata/`、`BuiltinNumberHandling`、`TasonTypeRegistry` 等）迁移并按 JS 能力改造——CLR 反射成员类型改为 **现成 schema 库 + adapter**；数值选项拆成序列化/反序列化两侧。对照表与有意差异见 [implementation-plan.md](./implementation-plan.md)「来源与 C# 对照」。

**用语：** RuntimeType / Schema / TypeName / TypeInstance / Number Handling 等见 [README 概念对照](./README.md#概念对照读本文档前)（本文件不重复）。

---

## 1. 问题与边界

| 难点 | 说明 |
| --- | --- |
| 无定长数值原语 | 仅 `number` / `bigint` |
| 动态结构 | 无 schema 时类型在值上或旁路 |
| 实体 / 接口协定 | 需要 Schema 表达 RuntimeType 形状（嵌套、数组元素是 bigint 还是 number） |
| 两套类型交叉 | TypeName ↔ RuntimeType 多对多（见 [README](./README.md)），需默认映射 + Handling / 鸭子选型 |
| 多实现同名 | 同一 TypeName 挂多个 JS 实现（包装类 / 未来 bson.Long 等） |

**本轮做**：Number Handling 拆分；**ClassMetadata = 现成库 Schema** + RuntimeType↔TypeInstance/字面量映射；鸭子类型。  
**本轮不做**：自研 TypeName 挂载 DSL 当主 API、ExtraMember、命名约定、多 schema 库全量适配。

---

## 2. 双路径与两层模型

```
  应用接口协定（RuntimeType）     TASON 文本（TypeInstance / 字面量）
  ┌─────────────────────┐       ┌──────────────────────┐
  │ 现成 Schema 库       │ 交叉  │ TypeRegistry TypeName │
  │ bigint / number[][] │ 映射  │ Int64 / BigInt / 裸字面量 │
  │ 嵌套 object …       │ ←──→  │ User({…}) / 数组     │
  └─────────────────────┘       └──────────────────────┘
         ClassMetadata                 Number Handling + 默认路径
```

两层**不是**粗细包含关系：同一 TypeName 可对应多种 RuntimeType（鸭子）；同一 RuntimeType 可对应多种 TypeInstance/字面量（如 `bigint` ↔ Int64 / BigInt / 裸字面量）。

| | 路径 A 动态 | 路径 B 实体 |
| --- | --- | --- |
| Schema | 无 | schema 库描述 RuntimeType 形状 |
| 值 | number / bigint / Decimal | 同左（与 Schema 一致） |
| TypeName / 字面量 | Number Handling + 值推断 | Schema 期望 RuntimeType + 默认映射 + Handling |

---

## 3. 数值：序列化 / 反序列化选项拆分（Number Handling）

精度陷阱主要在反序列化；序列化可保留 `none`，反序列化**无** `none`。

```ts
type SerializeNumberHandling =
  | "unsafe-only" | "all" | "object-type-property" | "none";  // 默认 unsafe-only

type DeserializeNumberHandling =
  | "native" | "all" | "object-fallback-native" | "object-fallback-all"; // 默认 object-fallback-native
```

| 序列化 | 行为 |
| --- | --- |
| `unsafe-only`（默认） | **仅当数值超出安全范围时才装箱**（TypeName）；安全范围内尽量裸字面量 |
| `all` | 可识别数值实现尽量装箱 |
| `object-type-property` | 对 **ObjectTypeInstance** 相当于 `all`；其它相当于 `unsafe-only`（与 .NET 同名） |
| `none` | **强制**所有数值为裸字面量（含超大 bigint / 超精度 Decimal，永不 TypeName） |

| 反序列化 | 行为 |
| --- | --- |
| `native` | **全拆箱**：原生 `number` / `bigint`；`Decimal128` → `Decimal`；**忽略**契约 |
| `all` | 保留包装类；**忽略**契约 |
| `object-fallback-native`（默认） | ObjectType 有字段契约 → RuntimeType；否则拆箱（native） |
| `object-fallback-all` | ObjectType 有字段契约 → RuntimeType；否则 OT 内 ≈ `all`、外 ≈ `native` |

拆箱约定：小整数/浮点 → `number`，Int64 → `bigint`，Decimal128 → `Decimal`。

> 阶段 1（无 Schema / 无 ObjectType 字段上下文）时：`object-fallback-*` 在反序列化上**降级为 `native`**；序列化 `object-type-property` **降级为 `unsafe-only`**。完整语义见阶段 2。
---

## 4. 实体元数据：Schema（现成库），不是 TypeName 表

### 4.0 早期意图

ClassMetadata 用**现成轻量库的 Schema**表达 **RuntimeType**，作**接口协定**；  
不是再描述 TASON 声明类型（那是 Registry / TypeName 的职责）。

| 层 | 问题 | 载体 |
| --- | --- | --- |
| Schema | 字段是 bigint 还是 number？`T[]`？嵌套对象？ | Zod / TypeBox / Valibot … |
| TypeInstance / 字面量 | 写 `Int64("…")` 还是裸 `1`？ | Registry + Number Handling |
| 映射 | RuntimeType ↔ TypeName/字面量（交叉） | 默认路径表 + Handling + 可选 override / 鸭子 |

### 4.1 为何不自研「字段 → Int64」树

那会变成**第二套类型描述 + 解析**，和 schema 库重复，还和 TS 推断脱节。  
真正缺的是：

1. RuntimeType 形状（库已擅长）  
2. 与 **TypeName / TypeInstance** 的**交叉映射**（本库独有、应很薄）

### 4.2 概念 API

```ts
interface TasonClassMetadata<S = unknown> {
  ctor?: abstract new (...args: any[]) => any;
  /** Schema（运行时契约），不是 TypeName 表 */
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

- 嵌套 VO：Schema 内 `object({…})`，**不必**每个都 register（除非要写成 ObjectTypeInstance `Address({…})`）  
- 多维数组：库的 `array(array(…))`，不自研 `Int32[][]` DSL  
- 结构 walk/校验：库自带；TASON 只在叶子做数值映射  

### 4.3 RuntimeType ↔ TypeInstance / 字面量：交叉映射与默认路径

两套体系**交叉**，不是粗细包含（详见 [README 概念对照](./README.md#概念对照读本文档前)）：

- **TypeName → 多 RuntimeType**：鸭子（同一 TypeName 多种 JS 实现）  
- **RuntimeType → 多 TypeInstance/字面量**：如 `bigint` 可对应 `Int64("…")`、`BigInt("…")` 或裸字面量  

ser/de 需要**默认路径**（下表）+ Number Handling；换路径用 override / brand / 鸭子 / `all` 等——**不要**为此重做整棵 TypeName 树。

| Schema 表达的 RuntimeType | 反序列化目标（默认） | 序列化默认路径（**Registry 定 TypeName**） |
| --- | --- | --- |
| `bigint` | bigint | Int64 / BigInt（随 Number Handling） |
| `number` | number | 裸字面量（**不**默认写成 Int32） |
| decimal 约定 / `instance(Decimal)` | Decimal | Decimal128 |
| string / bool | 字面量 | 字面量 |
| **`instance(RegExp)`** / **`date()`→Date** 等 | **对应 JS 构造函数的实例** | Registry 按 ctor 解析 TypeName → `RegExp(...)` / `Date(...)` |
| object / array | 递归 | 递归 |

**不要**在 Schema/RuntimeType 层发明 TypeName 标签（如把 RuntimeType 叫成 `"RegExp"` 字符串冒充 TypeName）。  
Schema 只回答「内存里是什么」；「文本里叫什么 TypeName」由 **Registry** 交叉映射。

反序列化时，多种 **数值** TypeInstance / **数字字面量** 可收敛到同一数字 RuntimeType（例如 `Int64("1")` 与 `BigInt("1")` 与字面量 `1` 在契约为 bigint 时都可得到 `1n`）。

**字面量保真：** JSON 风格字面量本身已是准确类型——字符串**只**是字符串，**不得**把 `"1"`、RFC3339、`"/a/"` 等字符串字面量解释成 number/Date/RegExp（那是 JSON 无类型时的妥协，TASON 不用）。  
`Date` / `RegExp` 等只能来自 **TypeInstance**（或已是该 ctor 的实例）。

### 4.4 `object-fallback-native` 在本模型下

- **命名含义**：优先使用 schema 契约解释字段（有则按 RuntimeType 收值），无契约则退回 native 拆箱——**不是**把 TypeName 记入侧信道  
- 应用层取值：拆箱后的 number / bigint / Decimal（或契约指定的 RuntimeType）  
- 有 Schema 时：按 **期望 RuntimeType** 收值（`Int64("1")` + bigint → `1n`；换路径的 TypeInstance 亦可收敛）  
- 数组/嵌套按 Schema 遍历，保证 `bigint[]` 元素真是 bigint  
- 再序列化靠 ser 侧 Handling + schema 期望 kind，而非 parse 时记住的 TypeName  

### 4.5 库与核心边界

| 原则 | 说明 |
| --- | --- |
| peer + adapter | 核心定义 `RuntimeSchemaAdapter`；官方提供 **一个**轻量实现（Valibot） |
| **已决议** | Valibot **导出**供一键选用；**默认不注册**任何 adapter；`setSchemaAdapter` 注册/替换/清除 |
| 公开元数据 API | **`getClassMetadata`**（整包）；**不**提供 `getSchema`（避免抬高外部库细节） |
| 存储 | Registry entry 旁路（R1）；JS 无 .NET 全局 Type 表，不模仿 Provider |
| 无 adapter / 无 metadata | 行为 = 现状 + 仅 Number Handling / 鸭子 |
| 无法识别 Schema | 忽略契约，回退无契约路径（不抛） |

```ts
interface RuntimeSchemaAdapter<S = unknown> {
  /** 提供字段路径上的 RuntimeType，供 ser/de 映射 */
  // 最小能力：遍历实体属性、识别 bigint|number|array|object|string|boolean|…
}
```

### 4.6 模块落位（对照 C#）

| 职责 | C# | JS 目标路径 |
| --- | --- | --- |
| 类型信息 | `TasonTypeInfo.cs`（库根） | `src/TASONTypeInfo.ts`（顶层） |
| 类元数据 / 装饰器 | `Metadata/` | `src/metadata/` |
| Schema introspect | （反射 PropertyType） | `src/schema/` + Valibot adapter |
| 内置类型实现 | `Types/` | `src/types/` |

### 4.7 本轮迁 / 不迁

| 迁 | 不迁 |
| --- | --- |
| Number Handling 双选项 | 自研 TypeName 挂载树作主 API |
| 鸭子类型 | ExtraMember / 命名约定 / 枚举元数据 |
| ClassMetadata.schema + 一个 adapter | 多库全适配 |
| 默认交叉映射路径 | 完整 brand/Int32 枚举体系（可薄做 override） |

---

## 5. 鸭子类型与多态

```ts
registerType("Int64", defaultInfo);
registerDuckType("Int64", bsonLongInfo);
```

同一 TypeName 多 RuntimeType/实现（鸭子）；与 Schema 层正交。`parseAs` 可按 ctor/Schema 期望选型。

---

## 6. 咬合

```
parse / parseAs(User)
  → deserializeNumberHandling
  → 有 Schema：按期望 RuntimeType 收值（object-fallback-native）
  → 映射：TypeInstance → bigint/number/…

stringify(user)
  → 有 Schema：按 RuntimeType + Number Handling 写出 TypeName 或字面量
  → 否则：鸭子/包装/Handling
```

---

## 7. 实施阶段（摘要）

进度入口：[implementation-plan.md](./implementation-plan.md)。

| 阶段 | 内容 | 分册 |
| --- | --- | --- |
| **1** | Number Handling 双选项；值级拆箱/写出；部分选项暂降级 | [phase-1](./phase-1-number-handling.md) **done** |
| **2.1** | Valibot 导出 + adapter；metadata；简单 object 叶子 | [phase-2](./phase-2-class-metadata-schema.md) **done** |
| **2.2** | 全部数值 × Schema × 数组/嵌套；Handling 完整语义 | 同上 |
| **3** | `registerDuckType`、`parseAs`、多态选型 | [phase-3](./phase-3-duck-types.md) |

---

## 8. 决议摘要

1. Number Handling 读写拆分；反序列化用 `native` 表示全拆箱（无 `none`）。  
2. **ClassMetadata = Schema（现成库）**，作接口协定（对照 C# 反射元数据）。  
3. **Registry + Number Handling** 在交叉关系上选定 **TypeName / TypeInstance 路径**；中间只有**薄映射**。  
4. 嵌套/多维数组交给 schema 库，不自研类型 DSL。  
5. `number` 默认不写成 Int32；其它 TypeName 路径用 override/brand/`all`/鸭子。  
6. 核心 adapter 接口 + 官方 **Valibot 实现导出**；默认不注册，一键 `setSchemaAdapter`。  
7. 公开 `getClassMetadata`，不公开 `getSchema`。  
8. 鸭子类型仍在 Registry 层。  
9. 目录：`TASONTypeInfo` 顶层化，`metadata/` / `schema/` 分治（阶段 2.1）。  
10. 功能自 **tason-net** 迁移；ExtraMember / naming / Enum 元数据本轮不迁。  
11. 阶段 2 测试新开文件覆盖全场景；未实现部分 skip/todo 默认通过。  

