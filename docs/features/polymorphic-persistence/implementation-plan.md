# TypeInstance 文档标记中间层 — 实施计划

> **状态：方向已锁定 · 实现未开工**  
> 设计：[design.md](./design.md)（**§0 架构为准**）

本文件只跟踪 **`toDocument` / `fromDocument`**。  
BSON 标量注册、核心 Number Handling / 多实现 API 都不在这里勾选。

---

## 0. 目标

1. 在 TASON 侧实现 **`toDocument` / `fromDocument`**：
   - 写出：每个已注册 **ObjectType** 节点写入 **`_t`（可配置）= TypeName**；
   - 读入：按标记 + Registry 还原实例；递归处理嵌套、数组、动态键下的实体。
2. 中间层 **不依赖** `bson` / `mongodb` / `tason-mongodb`。若 Registry 里已经有 BSON 类型，叶子会原样保留；没有也不阻塞本 feature。
3. 单测不连 Mongo：plain 对象往返即可。

### 成功标准

| # | 标准 |
| --- | --- |
| S1 | 嵌套动态字段中的 `User` / `Dog`：`toDocument` 各自带 `_t`；`fromDocument` 后 `instanceof` 正确 |
| S2 | 数组里混装已注册实体与 plain 对象：实体有 `_t`，plain 没有 |
| S3 | Scalar（如 `Date`）**没有** `_t`，实例原样保留 |
| S4 | 业务字段已经占用 `_t` → 明确报错 |
| S5 | 中间层模块 **不依赖** `bson` / `mongodb` / `tason-mongodb` |
| S6 | 设计文档写清与 BSON 扩展的组合用法（可选，不是实现前置） |

---

## 1. 包位置（锁定建议）

| 选项 | 决定 |
| --- | --- |
| **P1 核心导出**（`tason` 的 `toDocument` / `fromDocument`，或 `tason/document`） | **推荐** — 无 Mongo 依赖，任何文档库都可用 |
| P2 独立 `tason-document` 包 | 以后若要拆包再考虑；MVP 不必 |
| P3 放进 `tason-mongodb` | **否决** — 与「该包只做 BSON 标量」相反 |

MVP：**P1**。源码建议：`src/document/toDocument.ts`、`fromDocument.ts`、`index.ts`，再从根导出（或 subpath exports）。

---

## 2. 阶段

### 阶段 0 — 文档对齐

- [x] 架构：中间层打标；mongodb 包只做标量
- [x] 默认键 `_t`
- [x] 否决把中间层放进 tason-mongodb
- [ ] 导出路径最终名（根导出 vs `tason/document`）实现时再定

### 阶段 1 — MVP 中间层

| # | 任务 |
| --- | --- |
| 1.1 | `toDocument`：object kind → 写 `_t` + 递归字段；scalar → 原样保留；array 逐元素 |
| 1.2 | `fromDocument`：读 `_t` → 去掉该键 → 递归字段 → `createInstance` |
| 1.3 | 循环引用 throw |
| 1.4 | 键冲突 throw |
| 1.5 | 测试 S1–S5（`test/document-mapper.test.ts` 或包内 test） |
| 1.6 | 从 `src/index.ts`（或 package exports）导出 |
| 1.7 | 短说明（可先放本 feature README；面向用户的文档后补） |

**前置：** 现有 Registry 即可（`tryGetTypeInfo` / `createInstance` / `getDefaultType`）。

**DoD：** S1–S6；核心既有测试无回归。

### 阶段 2 — 增强（可选，不阻塞 MVP）

| # | 任务 |
| --- | --- |
| 2.1 | 根节点没有 `_t` 时，按 `expected` 还原实例 |
| 2.2 | 与 ClassMetadata schema 一起处理叶子字段 |
| 2.3 | 兼容读 `__t` / 多键别名（只读） |
| 2.4 | 与 `registerMongoDBTypes` 的组合示例（文档即可；集成测试可选） |

---

## 3. 测试矩阵（MVP）

| 编号 | 场景 |
| --- | --- |
| T1 | 单对象 `User` → 有 `_t: "User"` |
| T2 | 动态键 `{ a: new Dog(), b: { x: 1 } }` → 仅 Dog 带标记 |
| T3 | 数组 `[Dog, Cat, plain]` |
| T4 | 嵌套 `owner: User` 两层 ObjectType |
| T5 | `Date` / 数字叶子没有 `_t` |
| T6 | round-trip `fromDocument(toDocument(x))`：结构与 instanceof |
| T7 | 字段名 `_t` 冲突 → throw |
| T8 | 未知 `_t` TypeName → throw |

---

## 4. 明确不做

- 在 `tason-mongodb` 内实现 to / fromDocument
- 修改 `TASON.g4`
- 默认把子树存成 TASON 字符串
- 为标量再包一层 `{ _t, v }`
- 绑定 Mongoose 插件（用户可自行在两边选用）
- 把 BSON TypeInfo 的实现进度写进本 plan

---

## 5. 进度勾选

### 阶段 0

- [x] 架构锁定
- [ ] 导出路径最终名

### 阶段 1

- [ ] 1.1 toDocument
- [ ] 1.2 fromDocument
- [ ] 1.3 循环引用
- [ ] 1.4 键冲突
- [ ] 1.5 测试
- [ ] 1.6 导出
- [ ] 1.7 说明

### 阶段 2

- [ ] 2.x 增强（可选）

---

## 相关

- [design.md](./design.md)
