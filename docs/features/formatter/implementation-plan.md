# 语法层解析与格式化器 — 实施计划

> **状态：Phase A / B 已完成（未导出、未发布；导出与插件对接见 Phase C）**  
> 设计见 [design.md](./design.md)  
> 概念入口：[README.md](./README.md)

本文件只跟踪语法层与格式化器。值级 `parse` / `stringify`、VSCode 插件本体的进度不在这里勾选。

**首版范围（定稿）**：仅严格模式（出错即原样返回）；不实现数值优化与块注释优化（三个 `optimize*` 选项预留、传 `true` 视为 `false`）；**g4 注释通道变更在首版内**（注释收集与原样保留是格式化的硬前提）。见 Phase B。

---

## Phase A：语法层解析

- [x] `TASON.g4`：两条注释规则 `-> skip` 改 `-> channel(HIDDEN)`；`yarn generate`
- [x] 核心全量测试回归（至少 `number-handling` / `runtime-schema` / `multi-implementation`，加 `parse*` / `stringify*`），确认值级行为不变
- [x] `src/syntax/ast.ts`：`TASONExpression` 节点家族 + `TASONComment`（Babel 命名对齐：`type` 判别、`start` / `end`、字面量 `raw` / `value`；design §2.2）
- [x] `src/syntax/parseSyntax.ts`：薄 builder 把 ANTLR parse tree + token stream 转成 AST；收集型 ErrorListener（lexer / parser），捕获 `INVALID_CHAR` 词法 throw 转诊断
- [x] 模块边界自检：`src/syntax/` 不 import Registry / `types/` / `schema/` / `metadata/`
- [x] `test/syntax-parse.test.ts`

**DoD**：未注册 / 任意 TypeName 解析通过；注释全量出现在 `comments`；诊断含 offset / line / column；全量测试绿。✅（含错误恢复下部分树尽力返回；值缺失时 AST 为 null）

## Phase B：格式化器（首版）

- [x] 打印器：二态 group（平铺测宽 / 展开）、缩进、尾逗号、TypeInstance 间距、数字符号空白压缩、字符串解码重转义（design §3.2）
- [x] 选项（首版实现）：`tabWidth` / `useTabs` / `printWidth` / `singleQuote` / `quoteKeys` / `trailingComma` / `endOfLine`；`optimizeNumbers` / `optimizeNumberTypeInstances` / `optimizeBlockComments` 预留键，传 `true` 一律按 `false` 处理（design §3.3.1 首版范围注）
- [x] 自动检测：`singleQuote` / `useTabs` / `tabWidth` 的 `"auto"` 统计规则 + 输出上重检稳定性（design §3.3.3；tabWidth 平手规则实现时修正为取较大 w，design 已同步）
- [x] key 引号简化：`quoteKeys`（默认 `"as-needed"`）；解码值整匹配 IDENTIFIER 词法 + 黑名单 `{ true, false, null, NaN, Infinity }`（design §3.3.4）
- [x] 注释四类归属与重排（leading / trailing / dangling / 文件首尾），**注释 value 原样搬运（重拼定界符）**，注释与代码间空行压缩至 1；数值 `sign` + raw 同样原样输出（优化在 Phase D）
- [x] `formatTASON` 入口：**仅严格模式**——diagnostics 非空即返回原文，不暴露 `errorTolerance` 选项（design §2.4 / §3.5）
- [x] `test/formatter.test.ts`：幂等（含 `"auto"` 稳定性）、语义保真（`parse(format(x)) ≡ parse(x)`）、注释零丢失 × 首版选项矩阵；`optimize*` 传 `true` 等价 `false` 的用例

**DoD**：三条不变量在 fixture 全量 + 边界样本上成立；语法错误一律原样返回（含诊断信息）；数值 / 注释优化用例不在本阶段。✅（实现文件：`src/syntax/format/` 下 options / detect / comments / printer / formatTASON，及 `src/syntax/stringEscape.ts`、`tokenize.ts`）

## Phase C：导出、插件对接与文档

- [x] 前置：VSCode 插件仓库以 git submodule 嵌入 `extensions/vscode-tason`（`.gitmodules` 指向 GitHub 源仓库；非 yarn workspace，不影响根 build / test）
- [ ] `index.ts` re-export `parseSyntax` / `formatTASON` 与类型；新增子入口 `tason/syntax`
- [ ] `package.json` 加 `exports`（`.` / `./syntax` / `./package.json`）；`yarn build` 验证双入口产物
- [ ] 用户文档：`docs/formatting.md`（用法 + 选项表，标注三个 `optimize*` 首版未实现），根 README 链接
- [ ] CHANGELOG：随发布 minor 记录 `exports` 字段变更与新 API
- [ ] VSCode 插件（`extensions/vscode-tason`）：provider + 配置解析链（`tason.format.*` > `.tasonrc.json` > prettier JSON 家族 > 默认，逐字段合并；prettier 键映射与损坏降级；未实现选项透传、核心按 `false` 处理）+ 打包；改动在插件仓库内提交，此处勾选时更新 submodule 指针

**DoD**：`tason/syntax` 子入口可独立 bundle（不含 decimal.js 等值级依赖）；插件「格式化文档」可用，语法错误时提示且不改动文本。

## Phase D（后续，未排期）：数值优化、块注释优化与容错格式化

- [ ] 数值优化 `optimizeNumbers` / `optimizeNumberTypeInstances`：同进制等值规范化（JSON 文法优先、JS 字面量兜底、进制保留、`-0` → `0`）；decimal.js / BigInt 精确重排，禁 JS `number` 往返；输出重 lex 验证（design §3.3.2）
- [ ] `NUMBER_TYPE_NAMES` 抽到无依赖叶子模块，`types/NumberHandling.ts` re-export 保持兼容；Scalar 参数优化覆盖全名单并断言往返相等
- [ ] 块注释优化 `optimizeBlockComments`：纯字符串小型解析器（输入为 `CommentBlock.value`，已剥定界）——行内容四态判定（空白行 / 无 `*` 行缩进剥离 / `*` 后无空格 / `*` 后带空格，右端裁尾随空白）、空注释 `/* */` 连字安全、连续空行纵向不裁剪、首行空白不提行、内容前导空格不压缩、幂等（design §3.3.5）
- [ ] `errorTolerance: "best-effort"`：ErrorNode 子树按 start / end 原样保留原文，默认仍 `strict`（design §3.5）

**DoD**：三个优化选项真实生效且默认关闭；数值优化全表 + 块注释矩阵用例绿；`best-effort` 模式下语法错误不再阻断格式化。
