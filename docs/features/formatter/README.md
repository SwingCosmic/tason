# Feature：语法层解析与格式化器（formatter）

本目录是 **「TASON 文本 → 语法树（不依赖 Registry）→ 规范格式文本」** 的设计与计划，不是用户手册。

| 文档 | 职责 |
| --- | --- |
| **[design.md](./design.md)** | 分层与模块边界、AST 模型、grammar 注释通道变更、格式化规则与选项、插件对接契约 |
| **[implementation-plan.md](./implementation-plan.md)** | 本 feature 进度 |

### 一句话目标

为 VSCode 插件 vscode-tason（git submodule `extensions/vscode-tason`）的「格式化文档」提供核心包侧底座：`parseSyntax` 复用现有 ANTLR 解析产出**不查类型注册表**的语法树（任意 TypeName 合法、行/块注释保留、错误转为诊断），`formatTASON` 在其上**按格式化配置整体重排生成**规范文本（选项命名对齐 Prettier，含缩进/引号自动检测、数值优化与 key 去引号）。

### 负责 / 不负责

| | 本 feature | 不在本 feature |
| --- | --- | --- |
| 核心包 | `src/syntax/` 模块、AST 与诊断模型、格式化器与选项、`tason/syntax` 子入口 | 值级 `parse` / `stringify` 的任何语义（Handling、schema、Registry） |
| VSCode 插件 | 只记对接契约（design.md §5）：provider、配置链（`.tasonrc` > EditorConfig ~ 工作区 `tason.format.*` > prettier（开关、首版不做）> 全局 `tason.format.*` > 默认） | 插件本体实现（在插件仓库做）；插件**禁止**内置第二套 TASON 语法 |

语法层只共用 `TASON.g4` 与生成物，与 runtime-type / monorepo / polymorphic-persistence 没有排期互锁。
