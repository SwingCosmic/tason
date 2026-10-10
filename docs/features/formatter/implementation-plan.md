# 语法层解析与格式化器 — 实施计划

> **状态：阶段一已完成（1.3.0 待发布；插件改动在 submodule 工作区，提交后更新指针）**  
> 设计见 [design.md](./design.md)  
> 概念入口：[README.md](./README.md)

本文件只跟踪阶段与步骤清单，行为与实现细节以 design.md 为准，条目仅附章节引用。值级 `parse` / `stringify` 的进度不在这里勾选；插件本体进度在插件仓库，此处只跟踪对接步骤（勾选时更新 submodule 指针）。

## 阶段一：首版

严格模式格式化器 + 导出 + 插件对接。范围定稿见 design §8：仅严格模式；三个 `optimize*` 与 prettier 配置读取不做（归阶段二）；g4 注释通道变更在首版内。

### 步骤 1：语法层解析（design §2）

- [x] `TASON.g4` 两条注释规则改 `channel(HIDDEN)`；`yarn generate` + 核心全量回归
- [x] `src/syntax/`：AST 模型（`ast.ts`）、`parseSyntax`（诊断收集、注释收集、错误恢复下尽力返回）
- [x] 模块边界自检：不 import Registry / `types/` / `schema/` / `metadata/`
- [x] `test/syntax-parse.test.ts`

**DoD**：任意（未注册）TypeName 解析通过；注释全量出现在 `comments`；诊断含 offset / line / column；全量测试绿。✅（值缺失时 AST 为 null）

### 步骤 2：格式化器（design §3）

- [x] 打印器：二态 group、缩进、尾逗号、TypeInstance 间距、字符串解码重转义（design §3.2）
- [x] 首版选项与 `"auto"` 检测、key 引号简化 `quoteKeys`（design §3.3）
- [x] 注释四类归属与重排：文字原样、整体跟随缩进、空行压缩至 1、数值 raw 原样（design §3.4）
- [x] `formatTASON` 严格模式入口（design §2.4 / §3.5）
- [x] `test/formatter.test.ts`：幂等（含 `"auto"` 稳定）、语义保真、注释零丢失 × 选项矩阵；`optimize*` 传 `true` 等价 `false`

**DoD**：三条不变量在 fixture 全量 + 边界样本上成立；语法错误一律原样返回（含诊断）。✅

### 步骤 3：导出、插件对接与文档（design §4 / §5）

- [x] 前置：插件仓库以 git submodule 嵌入 `extensions/vscode-tason`（非 yarn workspace，不影响根 build / test）
- [x] `index.ts` 挂载 `TASON.parseSyntax` / `TASON.format`（函数本体仍名 `formatTASON`）；新增子入口 `tason/syntax`
- [x] `package.json` 加 `exports`（`.` / `./syntax` / `./package.json`）；`yarn build` 验证双入口产物
- [x] 用户文档 `docs/formatting.md`（用法 + 选项表，标注三个 `optimize*` 首版未实现），根 README 链接；CHANGELOG 随发布 minor 记录
- [x] 插件：provider + 配置解析链（design §5 第 3 条，含 `.tasonrc` 直读 `TASON.parse`、编辑器解析层、逐字段合并与降级）+ 打包与端到端联调

**DoD**：`tason/syntax` 子入口可独立 bundle（不含 decimal.js 等值级依赖）；挂载入口可用；插件「格式化文档」可用，语法错误时提示且不改动文本。

## 阶段二（未排期）：初期不做的功能

- [ ] 数值优化 `optimizeNumbers` / `optimizeNumberTypeInstances`（design §3.3.2）；`NUMBER_TYPE_NAMES` 抽无依赖叶子模块（design §2.1）
- [ ] 块注释优化 `optimizeBlockComments`（design §3.3.5）
- [ ] best-effort 容错 `errorTolerance`（design §3.5）
- [ ] prettier 配置读取：`tason.format.usePrettierConfig` 开关（design §5 第 3 条层 3；细节落地时重新检索确认，不得猜测）
- [ ] 小项：`.tasonrc` 向上递归查找、prettier JS / YAML / TOML 配置形态、range formatting（design §5）

**DoD**：延期选项真实生效且默认关闭；design §6 对应测试矩阵补齐；prettier 开关按检索确认的细节实现并回写 design。
