# Feature：TypeInstance 文档标记与中间层

本目录是 **「运行时对象图 ⇄ 带类型标记的 plain / BSON 文档」** 的设计与计划，不是用户手册。

| 文档 | 职责 |
| --- | --- |
| **[design.md](./design.md)** | 职责切分、标记语义、中间层 API |
| **[implementation-plan.md](./implementation-plan.md)** | 本 feature 进度 |

### 一句话目标

写入文档时，给每个需要保留类型的 **ObjectType** 节点加上标记字段（默认 `_t`，与 C# 驱动习惯相近）；读回时由 **TASON 侧中间层** 按标记和 Registry 还原实例。

`tason-mongodb` 只注册 BSON 标量，不负责对象多态或嵌套动态图。那是另一个 feature，与本中间层没有实现排期上的依赖。

### 实现时用到的已有 API

`toDocument` / `fromDocument` 调用现有 Registry：`tryGetTypeInfo`、`createInstance`、`getDefaultType`。  
这些 API 已经存在，不构成本 feature 对 runtime-type 或 monorepo 的进度依赖。
