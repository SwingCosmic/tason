# Feature：数值 · 运行时契约 · 鸭子类型

本目录是 **JS 运行时类型** 相关能力的完整实现资料包（设计 + 进度 + 分阶段任务），与其它 feature 隔离。

### 概念对照（读本文档前）

本 feature 讨论的是「应用里长什么样」和「TASON 文本里怎么写」两层，用语与 [type-system.md](../../type-system.md) 对齐：

| 概念 | 含义 | 例子 |
| --- | --- | --- |
| **运行时类型 RuntimeType** | JS 内存中的值的类型（**尽可能准确**） | `number` / `bigint` / **`instance(RegExp)`→RegExp 实例** |
| **运行时契约 Schema** | 现成库描述的**期望形状**，只表达 RuntimeType，**不写 TypeName** | Valibot：`v.object({ id: v.bigint(), re: v.instance(RegExp), when: v.date() })` |
| **TASON类型名称 TypeName** | Registry 注册名；文本中 TypeInstance 的名字 | `Int64`、`RegExp`、`User` |
| **TASON类型实例 TypeInstance** | TASON 中带类型名的值语法，分为 Scalar / Object 两种 | `Int64("1")`、`RegExp("/a/")`、`User({…})` |
| **字面量** | 无类型名前缀的 JSON 式写法 | `1`、`"a"`、`{ x: 1, y: 2 }` |
| **数值处理 Number Handling** | 何时用 TypeName 装箱、何时拆成原生值 | `unsafe-only`、`record-type`、`native` |
| **映射** | RuntimeType ↔ TypeInstance 或字面量（**交叉关系**；**Registry 负责**） | `bigint` ↔ `Int64`/`BigInt`；`instanceof RegExp` ↔ TypeName `RegExp` |

**职责边界（重要）：**

| 层 | 该说什么 | 不该说什么 |
| --- | --- | --- |
| **Schema** | 准确的 JS RuntimeType（`bigint`、`instance(RegExp)`、`date()`→Date） | TypeName 字符串（不要在 schema 里写「字段是 RegExp 这个 TypeName」） |
| **Registry** | TypeName ↔ 实现 / ctor；RuntimeType 实例 ↔ TypeInstance 文本 | 替代 schema 描述业务对象形状 |

**RuntimeType 与 TypeName 是交叉关系，不是谁粗谁细：**

| 方向 | 含义 | 例子 |
| --- | --- | --- |
| 一个 TypeName → 多个 RuntimeType | 鸭子类型：同名多 JS 实现 | TypeName `Int64` → 官方 `Int64` 包装 / MongoDB Long / … |
| 一个 RuntimeType → 多种 TypeInstance（或字面量） | 同一运行时种类可承载多种 TypeName/写法 | `bigint` → `Int64`/`BigInt`/裸字面量；`instanceof Date` → TypeName `Date`（及别名若有） |

默认映射表与 Number Handling 只是选定其中一条常用路径；override / 鸭子 / `all` 等用于换路径。  
class 实例字段用 **`instance(Ctor)`**（Date 可用库一等 `date()`），adapter 报告 `runtimeType: "instance"` + `instanceCtor`；**转 TypeName 一律走 Registry**（`findTypeNameByCtor` / `tryGetTypeInfo`）。

**字面量保真（JSON 风格字面量的含义）：**

TASON 中所有 JSON 风格字面量都表示「**已自带、无需再描述的准确类型**」，不是无类型的传输壳：

| 字面量 | 含义 | **禁止** |
| --- | --- | --- |
| 数字 `1` / `1.5` | 一定是某种**数字** RuntimeType | — |
| 字符串 `"…"` | **只**是字符串 | 用 `"1"` 表示数字；用 RFC3339 表示 Date；用 `"/a/i"` 表示 RegExp |
| 布尔 / null / 对象 / 数组字面量 | 即其本身结构 | 用对象字面量冒充已注册 ObjectType（除非再包 TypeName） |

Date、RegExp、UUID、Buffer 等 JSON 表达不了的类型，必须写 **TypeInstance**（`Date("…")`、`RegExp("/a/")`…）。  
字符串里塞日期/正则/数字是 **JSON 无法表达类型时的妥协**，TASON **不采用**。

> 若熟悉 Protobuf 等二进制协议：**TypeName** 大致对应其中的 *wire type* / 字段类型标签——标记「这段数据按什么类型解释」；TASON 是文本协议，正式用语仍是 **TypeName** 与 **TypeInstance**，文档正文不采用 wire 说法。

设计 / 进度 / 分册均引用本表，不另起概念说明。设计展开见 [runtime-type-design.md](./runtime-type-design.md)。

| 文档 | 职责 |
| --- | --- |
| **[implementation-plan.md](./implementation-plan.md)** | **进度入口**（总览、决策、DoD） |
| [runtime-type-design.md](./runtime-type-design.md) | 设计 |
| [phase-1-number-handling.md](./phase-1-number-handling.md) | 阶段 1 · 数值 Handling（**已完成**） |
| [phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md) | 阶段 2 · Class 元数据 + schema（**2.1 done · 2.2 next**） |
| [phase-3-duck-types.md](./phase-3-duck-types.md) | 阶段 3 · 鸭子 / 多态（待办） |

规范总览：[type-system.md](../../type-system.md) · C# 参考：`E:\dev\VS2022\tason-net`
