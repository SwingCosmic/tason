# Feature：Monorepo 与类型扩展包

本目录是 **仓库结构 + 扩展包约定 + `tason-mongodb`** 的设计与计划，不是用户手册。

| 文档 | 职责 |
| --- | --- |
| **[implementation-plan.md](./implementation-plan.md)** | 本 feature 进度（目录、工具链、迁移阶段） |
| **[phase-c-bson-types.md](./phase-c-bson-types.md)** | 官方类型清单、序列化/反序列化映射、选型分支、选项交叉设计要点与测试覆盖（行为矩阵在包 README） |

**动机：**

- 核心序列化与领域扩展不应绑在同一个 npm 包里，否则可选依赖（如 `bson`）和独立发版都会受影响。
- 姊妹实现 [.NET tason-net](https://github.com/SwingCosmic/tason-net) 已是「核心 + `TASON.Types.*` 扩展」。
- README 场景里已有 `ObjectId(...)` 等 MongoDB 语义，但这些类型 **不应** 进核心包（会拖进数据库栈）。

**本目录负责：** Yarn workspaces、扩展包注册约定、`tason-mongodb` 的 BSON **标量** TypeInfo。

**本目录不负责：**

- 核心 Number Handling / schema / `asDefault` / `parseAs` 的语义（已有能力，见 [runtime-type](../runtime-type/)）。
- 对象图 `_t`、`toDocument` / `fromDocument`（见 [polymorphic-persistence](../polymorphic-persistence/)）。

进度只看本目录的 implementation-plan，不要把其它 feature 的阶段勾进这里。
