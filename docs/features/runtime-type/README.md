# Feature：数值 · 运行时契约 · 鸭子类型

本目录是 **JS 运行时类型** 的设计、进度与分阶段任务，供开发对照，不是用户手册。

用语见顶层 [术语与用语](../glossary.md)，本目录不另写概念表。

**使用说明：** [数值处理](../../number-handling.md) · [实体元数据与 Schema](../../class-metadata.md) · [类型系统](../../type-system.md)

本 feature 的进度只看 [implementation-plan.md](./implementation-plan.md)。  
BSON 类型实现、文档 `_t` 不在这里跟踪。

| 文档 | 职责 |
| --- | --- |
| **[implementation-plan.md](./implementation-plan.md)** | **本 feature 进度**（总览、决策、DoD） |
| [runtime-type-design.md](./runtime-type-design.md) | 设计 |
| [phase-1-number-handling.md](./phase-1-number-handling.md) | 阶段 1 · 数值 Handling |
| [phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md) | 阶段 2 · Class 元数据 + schema |
| [phase-3-duck-types.md](./phase-3-duck-types.md) | 阶段 3 · 鸭子类型 / 默认实现 / parseAs |

C# 参考：`E:\dev\VS2022\tason-net`
