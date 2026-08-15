# Features（实现资料）

本目录是贡献者与 agent 用的 **设计与实施进度**，不是面向终端用户的使用手册。

用语权威：[术语与用语](./glossary.md)（RuntimeType / TypeName / 字面量 / 鸭子类型等）。各分册引用该文，不另起概念表。

面向用户的说明见仓库根 [README.md](../../README.md)，以及：

| 文档 | 说明 |
| --- | --- |
| [../type-system.md](../type-system.md) | 类型系统规范 |
| [../number-handling.md](../number-handling.md) | 数值处理 |
| [../class-metadata.md](../class-metadata.md) | 实体 Schema |
| [../regexp.md](../regexp.md) | RegExp |
| [../../packages/tason-mongodb/README.md](../../packages/tason-mongodb/README.md) | Mongo 扩展（使用说明） |

---

## 三个 feature 各自独立

进度、阶段勾选、DoD **只写在本 feature 自己的 `implementation-plan.md`**。  
不要把另一个 feature 的阶段号画进自己的进度图，也不要因为「以后可能组合使用」就互等对方做完。

| Feature | 本目录负责 | 不负责 | 进度 |
| --- | --- | --- | --- |
| [runtime-type/](./runtime-type/) | Number Handling、ClassMetadata / schema、同一 TypeName 的多实现与 `parseAs` | BSON 类型实现、文档 `_t` | [implementation-plan.md](./runtime-type/implementation-plan.md) |
| [monorepo/](./monorepo/) | Yarn workspaces、扩展包约定、`tason-mongodb` 的 BSON 标量 TypeInfo | 对象图 `_t`、核心 Handling / schema 的语义 | [implementation-plan.md](./monorepo/implementation-plan.md) |
| [polymorphic-persistence/](./polymorphic-persistence/) | `toDocument` / `fromDocument`、文档节点上的 `_t` | BSON TypeInfo、改 TASON 语法 | [implementation-plan.md](./polymorphic-persistence/implementation-plan.md) |

**实际依赖只有「使用已有 API」，没有排期上的互锁：**

- runtime-type 已完成。其它 feature 把它当成已经存在的 Registry / Handling / `asDefault` / `parseAs`，不要再同步它的阶段勾选。
- monorepo 与 polymorphic-persistence **没有实现前置关系**。前者注册 BSON 标量，后者给 ObjectType 写 `_t`。可以只做其中一件，也可以在应用里同时用。组合示例写在各自设计里即可，不要为此增加跨 feature 阶段。

---

## 文档归属

同一件事只在一处写正文；别处最多一句话指向权威文档。

| 内容 | 权威文档 |
| --- | --- |
| RuntimeType / Schema / TypeName / TypeInstance、字面量、鸭子类型 | [glossary.md](./glossary.md) |
| Number Handling 语义、ClassMetadata 模型 | [runtime-type/runtime-type-design.md](./runtime-type/runtime-type-design.md) |
| `asDefault` / `parseAs` / `getTypeInfoByCtor` | [runtime-type/phase-3-duck-types.md](./runtime-type/phase-3-duck-types.md) |
| `registerMongoDBTypes`、`replaceDefaultImplementation`、扩展包约定 | [monorepo/implementation-plan.md](./monorepo/implementation-plan.md) |
| 官方 BSON 清单与 ser/de 映射 | [monorepo/phase-c-bson-types.md](./monorepo/phase-c-bson-types.md) |
| `toDocument` / `fromDocument`、`_t` 语义 | [polymorphic-persistence/design.md](./polymorphic-persistence/design.md) |

职责边界可以在相邻 feature 里各写一句（例如「`tason-mongodb` 不做对象打标」），但不要互相抄阶段表。

每个 feature 目录内：**README** 说明本包是什么；**implementation-plan** 只记本包进度；设计 / 阶段分册写细节。
