# Feature：Monorepo 与类型扩展包

本目录是 **仓库结构改造 + 扩展包体系** 的实现资料（计划 / 决策），**不是**用户手册。

| 文档 | 职责 |
| --- | --- |
| **[implementation-plan.md](./implementation-plan.md)** | **进度入口**（目标、目录、工具链、迁移阶段、MongoDB 包范围） |

**动机摘要：**

- 当前单包 `tason` 把核心序列化与「未来领域扩展」绑在同一 npm 包内，不利于可选依赖（如 `bson`）与独立版本发布。
- 姊妹实现 [.NET tason-net](https://github.com/SwingCosmic/tason-net) 已采用「核心 + `TASON.Types.*` 扩展」模型（如 `TASON.Types.SystemTextJson`）。
- README 场景与示例已出现 `ObjectId(...)` 等 MongoDB 语义，但 **不应** 塞进核心包（会拖入数据库栈）。

**状态：** 阶段 A（核心迁入 monorepo）+ 阶段 B 脚手架（`tason-mongodb` 空壳 + `bson` peer）已落地；**类型实现与 `registerMongoDBTypes` 未开工**，后续步骤需再细化。

**相关：** [runtime-type](../runtime-type/)（鸭子类型阶段 3 与「Int64 → MongoDB Long」示例正交）；[polymorphic-persistence](../polymorphic-persistence/)（`_t` 中间层，与 BSON 包分列）；用户文档待扩展包实现后再补。
