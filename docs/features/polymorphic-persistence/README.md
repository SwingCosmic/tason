# Feature：TypeInstance 文档标记与中间层

本目录是 **「运行时 TypeInstance 图 ⇄ 带类型标记的 plain/BSON 文档」** 的设计 / 计划，**不是**用户手册。

| 文档 | 职责 |
| --- | --- |
| **[design.md](./design.md)** | 职责切分、标记语义、中间层 API、与 BSON 包边界 |
| **[implementation-plan.md](./implementation-plan.md)** | 阶段与 DoD |

### 一句话目标

对每个需要保真的 **TypeInstance 节点**（类比 C# 驱动的 `_t`），在写入文档时打上 **额外标记字段**；读回由 **TASON 侧中间层** 按标记 + Registry 还原为正确实例。  
**`tason-mongodb` 只做 BSON 标量类型保真**，不负责对象多态 / 嵌套动态图。

### 与其它计划

| 主题 | 文档 | 关系 |
| --- | --- | --- |
| monorepo + ObjectId/Long… | [../monorepo/](../monorepo/) | **只**标量；**禁止**把本中间层塞进该包 |
| 鸭子 / 默认实现 | [../runtime-type/phase-3-duck-types.md](../runtime-type/phase-3-duck-types.md) | hydrate 时用 `getDefaultType` / 3a 默认实现 |
| ODM discriminator | design §1.5–1.6 | 可并存；本中间层面向 **开放嵌套图** 与 **纯驱动** |
