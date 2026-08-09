# TypeInstance 文档标记中间层 — 实施计划

> **状态：方向已锁定 · 实现未开工**  
> 设计：[design.md](./design.md)（**§0 架构为准**）  
> **独立于** [monorepo](../monorepo/)（BSON 标量包 **不得** 包含本中间层）

---

## 0. 目标

1. 在 TASON 侧实现 **`toDocument` / `fromDocument`**：  
   - 出：每个已注册 **ObjectType** 节点写入 **`_t`（可配置）= TypeName**；  
   - 入：按标记 + Registry 还原实例；递归嵌套 / 数组 / 动态键下的实体。  
2. **`tason-mongodb` 只做 BSON 标量**；与中间层仅通过 **共享 Registry** 组合。  
3. 单测不连 Mongo：plain 往返即可。

### 成功标准

| # | 标准 |
| --- | --- |
| S1 | 嵌套动态字段中的 `User`/`Dog`：`toDocument` 各带 `_t`；`fromDocument` 后 `instanceof` 正确 |
| S2 | 数组混装注册实体 + plain：实体有标、plain 无标 |
| S3 | Scalar（Date / 若已 register 的 ObjectId）**无** `_t`，实例透传 |
| S4 | 业务字段已占用 `_t` → 明确错误 |
| S5 | 中间层模块 **零依赖** `bson`/`mongodb`/`tason-mongodb` |
| S6 | 文档写清与 monorepo 包组合用法 |

---

## 1. 包落点（锁定建议）

| 选项 | 决定 |
| --- | --- |
| **P1 核心导出**（`tason` 的 `toDocument`/`fromDocument`，或 `tason/document`） | **推荐** — 无 Mongo 依赖，任何文档库可用 |
| P2 独立 `tason-document` 包 | monorepo 后可选拆出；MVP 不必 |
| P3 放进 `tason-mongodb` | **否决** — 与用户分工相反 |

MVP：**P1**。源码建议：`src/document/toDocument.ts`、`fromDocument.ts`、`index.ts` 再从根导出（或 subpath exports）。

---

## 2. 阶段

### 阶段 0 — 文档对齐（本轮已完成大部分）

- [x] 架构：中间层打标 + mongodb 包仅标量  
- [x] 默认键 `_t`  
- [x] 否决中间层进 tason-mongodb  
- [ ] 导出路径最终名（根导出 vs `tason/document`）实现时定

### 阶段 1 — MVP 中间层

| # | 任务 |
| --- | --- |
| 1.1 | `toDocument`：object kind → 写 `_t` + 递归字段；scalar → 透传；array 逐元素 |
| 1.2 | `fromDocument`：读 `_t` → 去掉键 → 递归字段 → `createInstance` |
| 1.3 | 循环引用 throw |
| 1.4 | 键冲突 throw |
| 1.5 | 测试 S1–S5（`test/document-mapper.test.ts` 或包内 test） |
| 1.6 | 从 `src/index.ts`（或 package exports）导出 |
| 1.7 | 短用户说明（可先放 feature README 链，用户文档后补） |

**依赖：** 现有 Registry 即可；**不**要求 monorepo 完成。  
有 monorepo 后加 S3 的 ObjectId 集成测即可。

**DoD：** S1–S6；核心既有测试无回归。

### 阶段 2 — 增强（可选）

| # | 任务 |
| --- | --- |
| 2.1 | `expected` 根无 `_t` 时的水合 |
| 2.2 | 与 ClassMetadata schema 收叶子联动 |
| 2.3 | 兼容读 `__t` / 多键别名（只读） |
| 2.4 | 与 `tason-mongodb` 联调示例（文档 + 可选集成测） |

### 阶段 3 — monorepo 侧（**仅边界声明，无对象逻辑**）

| # | 任务 |
| --- | --- |
| 3.1 | monorepo plan / 包 README：**禁止** 对象打标；指向本 feature |
| 3.2 | 组合示例：`registerMongoDBTypes` + `toDocument`/`fromDocument` |

---

## 3. 测试矩阵（MVP）

| 编号 | 场景 |
| --- | --- |
| T1 | 单对象 `User` → 有 `_t: "User"` |
| T2 | 动态键 `{ a: new Dog(), b: { x: 1 } }` → 仅 Dog 带标 |
| T3 | 数组 `[Dog, Cat, plain]` |
| T4 | 嵌套 `owner: User` 两层 ObjectType |
| T5 | `Date` / 数字叶子无 `_t` |
| T6 | round-trip `fromDocument(toDocument(x))` 结构与 instanceof |
| T7 | 字段名 `_t` 冲突 throw |
| T8 | 未知 `_t` TypeName throw |

---

## 4. 明确不做

- 在 `tason-mongodb` 内实现 to/fromDocument  
- 修改 `TASON.g4`  
- 默认把子树存成 TASON 字符串  
- 为标量再包一层 `{ _t, v }`  
- 绑定 Mongoose 插件（用户可自行在两边选用）

---

## 5. 依赖图

```
Registry / tryGetTypeInfo / createInstance (已有)
        │
        ▼
  toDocument / fromDocument   ← 本 plan 阶段 1
        │
        │ 仅 Registry 组合
        ▼
  tason-mongodb 标量注册      ← monorepo plan（并行/先后皆可）
```

---

## 6. 进度勾选

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

### 阶段 2–3

- [ ] 2.x 增强  
- [ ] 3.x monorepo 边界与组合示例  

---

## 相关

- [design.md](./design.md)  
- [monorepo implementation-plan](../monorepo/implementation-plan.md)  
