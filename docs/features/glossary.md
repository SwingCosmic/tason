# 术语与用语

本文件是 `docs/features/` 的用语权威。各 feature 分册引用本文，不另起一套概念。

面向用户的规范见 [type-system.md](../type-system.md) 等；本文是实现对照，不是使用手册。

---

## 核心概念

TASON 同时谈「应用里长什么样」和「文本里怎么写」两层：

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| **运行时类型 RuntimeType** | JS 内存中的值的类型（**尽可能准确**） | `number` / `bigint` / **`instance(RegExp)` → RegExp 实例** |
| **运行时契约 Schema** | 现成库描述的**期望形状**，只表达 RuntimeType，**不写 TypeName** | Valibot：`v.object({ id: v.bigint(), re: v.instance(RegExp), when: v.date() })` |
| **TASON 类型名称 TypeName** | Registry 注册名；文本中 TypeInstance 的名字 | `Int64`、`RegExp`、`User` |
| **TASON 类型实例 TypeInstance** | TASON 中带类型名的值语法，分为 Scalar / Object 两种 | `Int64("1")`、`RegExp("/a/")`、`User({…})` |
| **字面量** | 无类型名前缀的 JSON 式写法 | `1`、`"a"`、`{ x: 1, y: 2 }` |
| **数值处理 Number Handling** | 何时用 TypeName 装箱、何时拆成原生值 | 序列化：`unsafe-only`…；反序列化：`object-fallback-native` / `native`… |
| **映射** | RuntimeType ↔ TypeInstance 或字面量（**交叉关系**；由 **Registry** 负责） | `bigint` ↔ `Int64`/`BigInt`；`instanceof RegExp` ↔ TypeName `RegExp` |

class 实例字段用 **`instance(Ctor)`**（Date 可用库提供的 `date()`），adapter 返回 `runtimeType: "instance"` + `instanceCtor`；**转成 TypeName 一律走 Registry**（`findTypeNameByCtor` / `tryGetTypeInfo`）。

> 若熟悉 Protobuf 等二进制协议：**TypeName** 大致对应其中的 *wire type* / 字段类型标签——标记「这段数据按什么类型解释」。TASON 是文本协议，正式用语仍是 **TypeName** 与 **TypeInstance**，正文不用 wire 这种说法。

---

## Schema 与 Registry

| 层 | 该说什么 | 不该说什么 |
| --- | --- | --- |
| **Schema** | 准确的 JS RuntimeType（`bigint`、`instance(RegExp)`、`date()` → Date） | TypeName 字符串（不要在 schema 里写「字段是 RegExp 这个 TypeName」） |
| **Registry** | TypeName ↔ 实现 / ctor；RuntimeType 实例 ↔ TypeInstance 文本 | 替代 schema 去描述业务对象形状 |

**ClassMetadata** 挂在已注册类型上，里面是现成库的 Schema（接口约定），不是 TypeName 表。没有 `setSchemaAdapter` 时，契约不生效。

---

## RuntimeType 与 TypeName 是交叉关系

不是谁粗谁细：

| 方向 | 含义 | 例子 |
| --- | --- | --- |
| 一个 TypeName → 多个 RuntimeType | 鸭子类型：同名多 JS 实现 | TypeName `Int64` → 官方 `Int64` 包装 / MongoDB Long / … |
| 一个 RuntimeType → 多种 TypeInstance（或字面量） | 同一运行时种类可写成多种 TypeName / 写法 | `bigint` → `Int64`/`BigInt`/裸字面量；`instanceof Date` → TypeName `Date`（及别名若有） |

默认映射表与 Number Handling 只是选定其中一条常用路径；override、追加类型实现、`all` 等用来换路径。

---

## 字面量的含义

TASON 里所有 JSON 风格字面量都表示「**已经带有、无需再描述的准确类型**」，不是没有类型信息的载体：

| 字面量 | 含义 | **禁止** |
| --- | --- | --- |
| 数字 `1` / `1.5` | 一定是某种**数字** RuntimeType | — |
| 字符串 `"…"` | **只**是字符串 | 用 `"1"` 表示数字；用 RFC3339 表示 Date；用 `"/a/i"` 表示 RegExp |
| 布尔 / null / 对象 / 数组字面量 | 即其本身结构 | 用对象字面量冒充已注册 ObjectType（除非再包 TypeName） |

Date、RegExp、UUID、Buffer 等 JSON 表达不了的类型，必须写 **TypeInstance**（`Date("…")`、`RegExp("/a/")`…）。  
把日期、正则、数字塞进字符串，是 JSON 无法表达类型时的折中，TASON **不采用**。

---

## 鸭子类型与多实现

「鸭子类型」是 contract / 结构相容的**通用说法**，文档可以写；**不要**把它塞进代码标识符。

同一 TypeName 下可以注册多种 JS 实现（官方包装、`bson.Long` 等）。这和 Schema 层无关：Schema 只描述 RuntimeType，不指定「parse 出来是哪一个类」。

| 说法 | 含义 | 典型 API |
| --- | --- | --- |
| **支持鸭子类型注册** | 对已有 TypeName 再 `registerType`（push） | `registerType("Int64", longInfo)` |
| **追加类型实现** | push，**不改**当前默认；stringify 能认出实例，parse 仍走默认 | 同上（缺省） |
| **默认实现** | `types[0]`；自动 `parse` 只认这个 | `getDefaultType` |
| **替换默认实现** | 把某个实现提升为 `types[0]` | `asDefault` / `setDefaultType` / `setDefaultTypeByCtor` |
| **多实现解析** | 单次按期望 ctor（或 TypeName）选型，不改全局默认 | `parseAs` / `getTypeInfoByCtor` |

扩展包若要把领域类设为默认（例如 `bson.Long` → `Int64`），内部调用 `asDefault`。包自己的选项名（如 `replaceDefaultImplementation`）写在对应扩展包计划里。

| 场合 | 规则 |
| --- | --- |
| **代码**（API、选项、文件名、符号、测试文件名） | **禁止** `duck` / `DuckType` / `duckOnto*` 等。用 `asDefault`、`setDefaultType`、`replaceDefaultImplementation`、`parseAs`、`getTypeInfoByCtor` |
| **文档叙述** | 可用完整说法：**鸭子类型**、**支持鸭子类型注册**、**追加类型实现**、**多实现解析** |
| **避免** | 单独写「鸭子」；生造「额外实现」当术语 |

API 形状与行为矩阵见 [runtime-type/phase-3-duck-types.md](./runtime-type/phase-3-duck-types.md)，本文件不重复。

---

## 其它常用说法

| 说法 | 含义 |
| --- | --- |
| **Scalar / 标量** | TypeInstance 的一种：用字符串参数构造，如 `Int64("1")`、`ObjectId("…")` |
| **ObjectType / 对象类型** | TypeInstance 的一种：用对象字面量构造，如 `User({…})` |
| **装箱 / 拆箱** | 写出 TypeName 包装，或还原成 `number` / `bigint` 等原生值 |
| **`_t`** | 文档映射层给 ObjectType 节点写的类型标记（默认键名）；不是 TASON 文本语法。见 [polymorphic-persistence](./polymorphic-persistence/) |
