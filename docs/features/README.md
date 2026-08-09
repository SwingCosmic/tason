# Features（实现资料）

本目录存放 **设计 / 实施进度** 等内部资料，供贡献者与 agent 对照，**不是**面向终端用户的使用手册。

用户文档请见：

| 文档 | 说明 |
| --- | --- |
| [../type-system.md](../type-system.md) | 类型系统规范 |
| [../number-handling.md](../number-handling.md) | 数值处理（使用） |
| [../class-metadata.md](../class-metadata.md) | 实体 Schema（使用） |
| [../regexp.md](../regexp.md) | RegExp |
| [../../README.md](../../README.md) | 安装与快速上手 |

| 子目录 | 主题 |
| --- | --- |
| [runtime-type/](./runtime-type/) | 数值 Handling · schema · 鸭子类型（设计与分阶段任务） |
| [monorepo/](./monorepo/) | Yarn workspaces · 扩展包约定 · `tason-mongodb`（A+B 脚手架已落地；类型实现待细化） |
| [polymorphic-persistence/](./polymorphic-persistence/) | TypeInstance 文档标记中间层（`_t` + to/fromDocument）；**与** monorepo BSON 标量包 **分列** |
