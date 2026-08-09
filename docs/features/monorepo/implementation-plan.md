# Monorepo 与 MongoDB 扩展包 — 实施计划

> **状态：阶段 A + B 脚手架已落地；类型实现与后续阶段待细化**  
> 概念入口：[README.md](./README.md)  
> 姊妹实现：`E:\dev\VS2022\tason-net`（`TASON` + `TASON.Types.*` + `TASON.AspNetCore`）

---

## 0. 目标与非目标

### 0.1 目标

1. 将本仓库改为 **Yarn Workspaces monorepo**，核心与扩展可独立构建、测试、发布。
2. 抽出可复用的 **类型扩展包约定**（注册入口、peer 依赖、测试布局），首个实现为 **MongoDB / BSON 内置类型包**。
3. 保持 npm 上核心包名 **`tason`** 与既有 API 兼容；消费者未装扩展包时行为不变。
4. 文档与 `AGENTS.md` 源码地图同步到 monorepo 布局。

### 0.2 非目标（本计划不做）

| 项 | 说明 |
| --- | --- |
| 改 TASON 语法 / ANTLR | 扩展只注册 TypeName，不改 `TASON.g4` |
| 在核心内置 ObjectId | 避免核心依赖 `bson` / `mongodb` |
| 完整 MongoDB 驱动封装 | 只做 **TASON TypeName ↔ BSON 值** 的 ser/de |
| **对象图 `_t` 打标 / toDocument / fromDocument** | **禁止** 放进 `tason-mongodb`；见 [polymorphic-persistence](../polymorphic-persistence/)（TASON 中间层） |
| 一次迁完所有未来扩展 | 只落地 MongoDB 包；约定留好即可（JSON 库扩展、AspNet 对等物等后续） |
| 强依赖阶段 3 鸭子类型全部完成 | MongoDB **MVP 可先用现有 `registerType` 多实现**；默认实现见 3a |
| Turborepo / Nx / Changesets 一上来全套 | 首期 workspaces + 脚本即可；发布编排可二期 |

---

## 1. 背景与决策依据

### 1.1 现状

| 项 | 当前 |
| --- | --- |
| 包 | 单包 `tason@1.1.x`，源码 `src/`，产物 `lib/`，测试 `test/` |
| 工具 | Yarn Classic（1.22）、`tsc` + `tsc-alias`、Jest、`@/*` → `src/*` |
| 扩展点 | `TASONTypeRegistry.registerType` / `registerTypeAlias`；构造时注入 `Types` 内置表 |
| 内置类型 | 数字、Date*、RegExp、UUID、Buffer、JSON*、Dictionary 等（见 `src/types/`） |
| 用户示例 | README 已写 `ObjectId("…")`，**核心尚无实现** |

### 1.2 为何 monorepo 而不是多仓库

- 扩展包与核心 **同版语义对齐** 频繁（TypeInfo 形状、Registry API、Handling 选项）。
- 共享 `docs/`、CI、测试夹具；一次 PR 可同时改 core + extension。
- 对照 C#：同一 solution 多 project，而非拆成多个 git 仓库。

### 1.3 工具链选择

| 选项 | 结论 |
| --- | --- |
| **Yarn Workspaces（Classic 即可）** | **采用**。仓库已有 `yarn.lock` 与 Yarn 1.x 习惯；改动最小。 |
| pnpm / yarn berry | 不强制；若日后统一工具链可再迁，布局不变。 |
| Lerna | 不需要；workspaces + 根 scripts 足够。 |
| 根目录 TypeScript project references | **推荐**（`composite` + references），便于 `tsc -b` 按依赖序构建。 |

### 1.4 包命名

| 角色 | npm name | 目录 | 说明 |
| --- | --- | --- | --- |
| 核心 | `tason` | `packages/tason` | **保持** 已发布名，避免 breaking rename |
| MongoDB 扩展 | `tason-mongodb` | `packages/tason-mongodb` | 无 scope，与 `tason` 一致；语义对齐 C# `TASON.Types.*` |

**不采用** `@tason/core` 一类重命名（除非将来做 major 迁移公告）。  
后续扩展建议统一：`tason-<domain>`（如 `tason-graphql`），文档中称 **Types 扩展包**。

---

## 2. 目标目录结构

```
tason/                          # git 仓库根
  package.json                  # private: true；workspaces；根脚本
  yarn.lock
  tsconfig.base.json            # 共享 compilerOptions（从现有迁移/精简）
  jest.config.base.cjs          # 可选：共享 Jest 预设
  AGENTS.md
  README.md                     # 产品总览 + monorepo 说明入口
  LICENSE
  docs/                         # 规范 + features（保持仓库根，跨包共享）
    features/
      monorepo/                 # 本计划
      runtime-type/
      …
  packages/
    tason/                      # 核心包（现 src/test/package 迁入）
      package.json              # name: tason
      tsconfig.json
      jest.config.cjs
      src/
      test/
      lib/                      # build 输出（gitignore）
    tason-mongodb/
      package.json              # name: tason-mongodb
      tsconfig.json
      jest.config.cjs
      src/
      test/
      lib/
      README.md                 # 包级使用说明（可发布到 npm）
```

### 2.1 根 `package.json` 要点

```json
{
  "name": "tason-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "yarn workspaces run build",
    "test": "yarn workspaces run test",
    "generate": "yarn workspace tason generate"
  }
}
```

- 根 **不发布**。
- 公共 devDependencies（typescript、jest、ts-jest…）优先放在 **根** 或 **核心包**（二选一写进阶段 1 DoD；推荐根装工具链、各包声明自己的 runtime/peer）。

### 2.2 核心包迁入后路径

| 现路径 | 新路径 |
| --- | --- |
| `src/**` | `packages/tason/src/**` |
| `test/**` | `packages/tason/test/**` |
| `lib/**` | `packages/tason/lib/**` |
| 根 `package.json` 可发布字段 | `packages/tason/package.json` |
| `tsconfig.json`（paths `@/*`） | `packages/tason/tsconfig.json` |
| `jest.config.cjs` | `packages/tason/jest.config.cjs`（mapper 指向本包 `src`） |
| `src/grammar` + `yarn generate` | 仍在核心包内 |

`docs/`、`AGENTS.md`、根 `README.md` **留在仓库根**。

---

## 3. 类型扩展包约定（通用）

所有 Types 扩展包遵循同一契约，避免每个包发明不同注册姿势。

### 3.1 依赖

| 依赖 | 规则 |
| --- | --- |
| `tason` | **peerDependency**（版本区间与核心 semver 对齐，如 `^1.1.0`）；devDependency 钉工作区内协议便于联调 |
| 领域库（如 `bson`） | **peerDependency**（可选/必选写清）；扩展包不强制用户装完整 `mongodb` 驱动，优先 `bson` |
| 核心内部路径 | **禁止** `tason/lib/...` 深路径；只依赖公开 API（`defineType`、`TASONTypeRegistry`、类型导出） |

### 3.2 公开 API 形状（推荐）

```ts
// packages/tason-mongodb/src/index.ts
import type TASONTypeRegistry from "tason/…"; // 以最终导出为准

/** 类型实现表（便于测试与高级定制） */
export const MongoTypes: Record<string, TASONTypeInfo<any>>;

/**
 * 向 registry 注册本包全部类型（幂等策略见 §3.3）。
 * 对齐 C#：TasonTypeRegistry.AddSystemTextJson(...)
 */
export function registerMongoDBTypes(
  registry: TASONTypeRegistry,
  options?: RegisterMongoDBTypesOptions,
): TASONTypeRegistry;

export type RegisterMongoDBTypesOptions = {
  /** 是否把 bson.Long 等挂到已有 TypeName（Int64 等）上，默认 true */
  duckOntoBuiltins?: boolean;
  /**
   * 将 Mongo 运行时类设为对应 TypeName 的 **默认实现**（依赖核心 3a：`setDefaultType` / `asDefault`）。
   * 开启后 parse `Int64("…")` 直接得到 `bson.Long`，减少与驱动之间的反复装箱抖动。
   * 默认建议：Mongo 优先应用可 `true` 或按 TypeName 细开；纯文档交换可只 duck 不改默认。
   */
  defaultImplementations?: boolean | {
    Int64?: boolean;
    Decimal128?: boolean;
    // …
  };
  /** 选择性注册；默认全部 */
  include?: MongoTypeName[];
};
```

**用法（用户向，落地后写入包 README）：**

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
registerMongoDBTypes(s.registry);

s.parse(`{ _id: ObjectId("6670f391dcb0bd791cb3bd18") }`);
```

不强制改核心增加 `serializer.use(plugin)`；若后续多扩展需要插件链，可另开 issue。首期 **函数式注册** 足够，且与 C# 扩展方法同构。

### 3.3 注册策略

| 策略 | 说明 |
| --- | --- |
| **新增 TypeName** | 如 `ObjectId`、`MinKey`：`registerType` 即可 |
| **鸭子到已有 TypeName** | 如 bson `Long` → TypeName `Int64`：`registerType("Int64", longTypeInfo)`（push）。仅此则 parse **仍 core 默认**；stringify 时 `instanceof` 命中鸭子 |
| **设为默认实现（推荐 Mongo 优先）** | 依赖核心 **[phase-3 · 3a](../runtime-type/phase-3-duck-types.md)**：`registerType(..., { asDefault: true })` 或 `setDefaultType`。parse `Int64("…")` → `bson.Long`，多轮 ser/de RuntimeType 稳定 |
| **别名** | 如需要 `Long` 作为独立 TypeName 写出：`registerTypeAlias("Long", "Int64")` 或单独 scalar（**二选一写进 MongoDB 分阶段**，避免双语义） |
| **幂等** | 文档约定「同一 registry 只 register 一次」；实现侧可不强制检测，测试覆盖重复注册行为 |

与 [phase-3-duck-types](../runtime-type/phase-3-duck-types.md) 的关系：

| 能力 | 何时 | Mongo 是否硬依赖 |
| --- | --- | --- |
| 多实现 + stringify 鸭子 | **已有** | 仅 duck 场景够用 |
| **3a 指定默认实现** | **Mongo P0 前或同步** | **要做「默认 Long」时硬依赖** |
| 3b `parseAs` / `registerDuckType` 打磨 | 可后置 | 否（单次选型；全局默认用 3a） |

**不需要**等完整阶段 3 做完再开 Mongo；**需要**调整阶段 3 范围并 **提前 3a**。

### 3.4 核心需保证的公开导出（迁包时核对）

扩展包至少需要能 import：

- `defineType` / `TASONTypeInfo`
- `TASONTypeRegistry`（类型 + 实例方法）
- 若扩展需要与 Handling 交互：`TASONSerializerOptions` 相关类型

**检查项：** `packages/tason/src/index.ts` 是否已 re-export；缺则补导出（小改动，属 monorepo 阶段 1 可做）。

当前 `TASONTypeRegistry` 仅 default export 在模块内，扩展通过 `serializer.registry` 拿到实例即可，**不必**要求用户 `new Registry`。

---

## 4. MongoDB 包：类型范围

### 4.0 生态调研：BSON 运行时到底是什么

Node 侧 Mongo 生态几乎都收敛到官方 **`bson` / `mongodb` 捆绑的 BSON 类**，而不是各插件自造值类型。TASON 扩展只要 **ctor 与应用里的是同一份类**（`instanceof` 成立），就能对「驱动 / Mongoose 文档字段」生效；**不会**自动接入 SchemaType 注册或 cast 管线。

| 库 / 层 | 做法 | 文档字段上的 RuntimeType |
| --- | --- | --- |
| **`bson` / `mongodb` 驱动** | 权威实现；`ObjectId`、`Long`、`Decimal128`、`Binary`、`Double`、`Timestamp`、`UUID`… 均从此包（或 `mongodb` 再导出） | 读写文档时即为这些类的实例 |
| **`mongoose-long`** | **不**另造 Long：`Types.Long = mongoose.mongo.Long`；自定义 `Schema.Types.Long` 只做 **cast**（`fromNumber` / `fromString` / `instanceof mongo.Long`） | 路径上是 **`bson.Long`（即 driver Long）** |
| **Mongoose 内置** | `Types.Decimal128` **直接 re-export** `mongodb` 的 BSON Decimal128；`Types.ObjectId` 同族；`Schema.Types.*` 是配置，**不是**值类型 | ObjectId / Decimal128 等为 BSON 实例 |
| **Mongoose `BigInt` SchemaType** | 存库为 BSON long，**内存为原生 `bigint`** | **不是** `Long` 实例 → 走核心 `bigint` / Int64 路径，不是 Mongo 鸭子 |
| **Mongoose `Int32` / `Double`** | Int32 常为 **number**；Double 常为 **`bson.Double` 包装** | 与「裸 number」不完全同一 |
| **Mongoose UUID** | BSON Binary subtype 4；访问时可能 getter 成 **string** | ser 前注意是 Binary 还是 string |
| **Typegoose 等** | 建立在 Mongoose 之上，值类型仍是 `mongoose.Types.*` / bson | 同 Mongoose |
| **EJSON / Extended JSON** | 文本形态 `{"$oid":"…"}` 等，**不是** TASON | 不互通；若需要可另做转换层，不进本包 P0 |

**对 `tason-mongodb` 能否「对这些库生效」的判定：**

| 场景 | 能否生效 | 条件 / 注意 |
| --- | --- | --- |
| `stringify` 查询结果 / `lean()` 文档中的 `ObjectId`、`Long`、`Decimal128` | **能** | 注册对应 TypeInfo，且 **`instanceof` 命中**（同一 bson 副本） |
| `parse` 出上述类型再 `insertOne` / 赋给 mongoose 路径 | **能** | 3a 将默认实现设为 BSON 类，或业务侧接受 cast；`mongoose-long` 的 `cast` 也认 `instanceof mongo.Long` |
| 未 `registerMongoDBTypes` 就 parse `ObjectId("…")` | **不能** | 核心无 ObjectId |
| 直接 `stringify(mongooseDocument)` 整棵 Document | **部分** | Document 有原型/内部状态；**推荐 `doc.toObject()` / `lean()`** 后再 stringify |
| Schema 声明为 `BigInt` 的字段 | **靠核心** | 值是 `bigint`，用核心 number handling / Int64，不必 Mongo Long 鸭子 |
| 双份 `bson`（nested node_modules） | **易失效** | `instanceof` 失败 → stringify 认不出、parse 出的类驱动不认。**强制 peer `bson`，文档要求与 `mongodb`/`mongoose` 对齐版本** |
| 插件自定义 SchemaType 但值仍是 bson 类 | **能** | 与 mongoose-long 同模式 |
| 插件自造 **非 bson** 的包装类 | **默认不能** | 需再 register 鸭子或适配；本包不承诺扫插件 |

**设计推论（固定）：**

1. TypeInfo 的 `ctor` **优先使用 `bson` 包导出**（`ObjectId`、`Long`、`Decimal128`…），不要自建平行类。  
2. `peerDependencies`：`bson`（及文档说明：与项目中 `mongodb` / `mongoose` 解析到的 bson 一致）。可选说明也可 `import { Long } from "mongodb"`，但 monorepo 实现侧统一从 `bson` import，避免分叉。  
3. **不为 mongoose-long 写专用适配**；兼容其文档字段 = 兼容 `bson.Long`。  
4. README 写清：对 Mongoose 先 `toObject({ flattenMaps: true })` 等再 TASON；BigInt Schema ≠ Long 鸭子。  
5. 双包危害写进风险表与测试：可用集成测「从 mongoose 取出的 ObjectId 能被 registry 认出」。

### 4.1 设计原则

1. **TypeName 语言无关**：文本里写 `ObjectId("…")`，运行时用 **`bson.ObjectId`**（直接官方类，保证 `instanceof`）。
2. **能复用核心 TypeName 的复用**（鸭子），避免「同一语义两个 TypeName」除非生态惯例不同。
3. **命名冲突显式处理**（见下表 Timestamp / Decimal128 / UUID）。
4. 依赖 **`bson` peer**（权威运行时）；不强制 peer 完整 `mongodb`，但允许用户从驱动 re-export 拿到同一类。
5. **不**做 Mongoose SchemaType / 插件注册；只做 TypeName ↔ BSON 值。

### 4.2 类型矩阵

| 优先级 | TypeName（TASON 文本） | 运行时（建议） | 策略 | 备注 |
| --- | --- | --- | --- | --- |
| **P0** | `ObjectId` | `bson.ObjectId` | **新 TypeName** | README 示例刚需；hex 24 字符 |
| **P0** | `Int64` | `bson.Long` | **鸭子**到内置 `Int64` | 与 runtime-type 概念表一致；默认 parse 仍 core `Int64` 包装 |
| **P0** | `Decimal128` | `bson.Decimal128` | **鸭子**到内置 `Decimal128` | 字符串参数与 Extended JSON 对齐 |
| **P1** | `Binary` 或 `BinData` | `bson.Binary` | 新 TypeName | 与核心 `Buffer` 并存：`Buffer` 通用 base64/hex；Binary 保留 subtype |
| **P1** | `UUID` | `bson.UUID` / Binary subtype | 鸭子到 `UUID` 或独立 | 需对比核心 `UUID` 字符串形式，避免双重默认 |
| **P2** | `MinKey` / `MaxKey` | `bson.MinKey` / `MaxKey` | 新 TypeName | 标量参数可为空串或固定字面量（实现时定） |
| **P2** | MongoDB `Timestamp` | `bson.Timestamp` | **慎用名** | 核心已有 **毫秒** `Timestamp`；**不可**静默覆盖。可选：`BsonTimestamp` / `MongoTimestamp`，或仅鸭子且不改默认 types[0] |
| **P3** | `Code` / `DBRef` 等 | 对应 bson 类型 | 按需 | 非查询 DTO 主路径，可后置 |
| 通常不注册 | `Date` / `RegExp` / 普通 number | 核心已覆盖 | — | BSON Date ↔ JS Date 已由核心 `Date` 处理 |

### 4.3 与核心类型的边界

| 核心已有 | Mongo 包态度 |
| --- | --- |
| `Date` | 不重复注册；文档说明 Mongo 日期用 `Date("…")` |
| `RegExp` | 同上；若需 BSON RegExp 选项差异，P3 再评估 |
| `Buffer` | 通用二进制；Mongo `Binary` 有 subtype → 单独 TypeName |
| `UUID` / `Decimal128` / 数字包装 | 鸭子增强，不替换默认实现 |
| `Timestamp`（毫秒） | **保留核心语义**；BSON Timestamp（ordinal + t）另名或后置 |

### 4.4 序列化形态（P0 草案）

| TypeName | 标量字符串示例 | 说明 |
| --- | --- | --- |
| `ObjectId` | `ObjectId("6670f391dcb0bd791cb3bd18")` | 小写 hex，与 Mongo shell / 工具一致 |
| `Int64`（Long 实例） | `Int64("6571037680684232705")` | stringify 鸭子 Long 时写 Int64；不强制写 `Long(...)` 除非做了别名 |
| `Decimal128` | `Decimal128("114514.1919")` | 与核心一致 |

对象类型（ObjectType）首期 **不需要**（BSON 特殊类型多为 scalar）。

### 4.5 测试（`packages/tason-mongodb/test`）

| 编号 | 场景 |
| --- | --- |
| M1 | 未 register：parse `ObjectId("…")` 失败或未知类型（与现 Registry 行为一致） |
| M2 | register 后 round-trip `ObjectId` |
| M3 | `stringify(new ObjectId(…))` → `ObjectId("…")` |
| M4 | `stringify(Long.fromString(…))` → `Int64("…")`（鸭子） |
| M5 | parse `Int64("…")` 默认仍为核心实现（非 Long），除非日后 `parseAs` |
| M6 | Decimal128 鸭子 round-trip（实例为 bson.Decimal128） |
| M7 | 与核心 number-handling 无回归（扩展包测试不复制全量矩阵） |
| M8 | `instanceof`：用 `bson.ObjectId` / `Long` 构造的值能 `tryGetTypeInfo`（模拟驱动读出的值） |
| M9（可选集成） | 若 devDep 含 mongoose：`lean()` 文档中 ObjectId/Decimal128 round-trip（不强制 CI 必装） |

测试依赖：workspace 协议引用 `tason`；`bson` 为 devDependency。

---

## 5. 迁移阶段

### 阶段 A — Monorepo 脚手架（行为零变更）

**目的：** 目录与工具就位，核心仍单一可发布包。

| # | 任务 |
| --- | --- |
| A.1 | 根 `package.json`：`private` + `workspaces: ["packages/*"]` |
| A.2 | 创建 `packages/tason/`，迁入 `src`、`test`、原 package 元数据、tsconfig、jest |
| A.3 | 根保留 `tsconfig.base.json`；包内 extends；修正 `outDir` / `paths` / jest `moduleNameMapper` |
| A.4 | `.gitignore`：`packages/*/lib`、`.antlr` 等；删除根级 `/lib` 规则或改为通配 |
| A.5 | 根脚本：`build` / `test` / `generate` 代理到 workspace |
| A.6 | 跑通 `yarn install`、`yarn workspace tason build`、`yarn workspace tason test` |
| A.7 | 更新 `AGENTS.md` 源码地图与命令；根 README 加「仓库结构」一小节 |
| A.8 | 确认 `publishConfig` 仍在 `packages/tason`；从包目录 `yarn npm publish` / `npm publish` 路径写进 AGENTS 或 CONTRIBUTING 备忘 |

**DoD：** 核心测试全绿；对外 import 路径仍为 `tason`（未发版前仅本地验证）；无 Mongo 代码。

**风险：** 历史 git 对 `src/` 的 blame 因移动变模糊 → 可用 `git mv` 保留历史。

### 阶段 A′ — 核心 3a（可与 A 并行或紧接 A）

| # | 任务 |
| --- | --- |
| A′.1 | 实现 `setDefaultType` / `registerType(..., { asDefault })`（见 [phase-3 3a](../runtime-type/phase-3-duck-types.md)） |
| A′.2 | 核心测试 D0–D0d；`clone` 保持默认 |
| A′.3 | 导出公开 API；implementation-plan / phase-3 勾选 3a DoD |

**DoD：** 可把任意已注册实现设为某 TypeName 的 parse 默认；builtin 无回归。

> 若暂不做「默认 Long」、只 duck：A′ 可延后，但 **推荐与 Mongo P0 一起做**，否则用户仍踩反复转换问题。

### 阶段 B — 扩展约定落地 + MongoDB 骨架

| # | 任务 |
| --- | --- |
| B.1 | 核对并补齐核心公开导出（`defineType`、`setDefaultType` 等） |
| B.2 | `packages/tason-mongodb`：package.json（peer: `tason`, `bson`）、tsconfig、jest |
| B.3 | `registerMongoDBTypes` 空实现 + 导出表结构 + `defaultImplementations` 选项形状 |
| B.4 | 包 README：安装、register 示例、**默认实现 vs 仅鸭子** |
| B.5 | 工作区联调：core 改 API 时 extension 编译失败应可见 |

**DoD：** 包可 build；register 空操作不破坏 registry；至少 1 个 smoke test。

### 阶段 C — MongoDB P0 类型

| # | 任务 |
| --- | --- |
| C.1 | `ObjectId` TypeInfo + 测试 M1–M3 |
| C.2 | `Long` → `Int64` 鸭子 + M4–M5；**可选/推荐** `defaultImplementations.Int64` + 多轮 round-trip 类型稳定测 |
| C.3 | `bson.Decimal128` → `Decimal128` 鸭子 + M6；同上默认开关 |
| C.4 | `docs/type-system.md` 增加「扩展类型 / MongoDB」交叉链接（用户向短节或链到包 README） |
| C.5 | 根 README 示例改为「需 `tason-mongodb`」的明确说明 |

**DoD：** P0 矩阵测试绿；README 示例可复制运行；文档写清默认实现配置。

### 阶段 D — P1 / 发布与文档抛光

| # | 任务 |
| --- | --- |
| D.1 | Binary（及可选 UUID 策略定稿） |
| D.2 | 版本策略：core 与 mongodb **独立 semver**；mongodb 初始 `0.1.0` 或 `1.0.0-beta` |
| D.3 | CI（若有）：matrix 构建两个包；发布 workflow 按 path filter |
| D.4 | 本 plan 勾选进度；features/README 状态更新 |

**后置（不阻塞首发）：** MinKey/MaxKey、BsonTimestamp 命名、阶段 3 `parseAs` 示例、Changesets。

---

## 6. 版本与发布

| 策略 | 选择 |
| --- | --- |
| 版本号 | **独立版本**（core `1.x`，mongodb 自 `0.x`/`1.x` 起） |
| 兼容 | mongodb 的 `peerDependencies.tason` 声明支持的 core 范围 |
| 发布顺序 | 先 core（若有 API 导出补丁），再 mongodb |
| 锁文件 | 单根 `yarn.lock` |

破坏性：monorepo **本身**对只 `npm i tason` 的用户无影响；仅贡献者克隆路径变化。

---

## 7. 文档与 Agent 约定变更清单

| 文档 | 变更 |
| --- | --- |
| `AGENTS.md` | 源码地图改为 `packages/tason/src`；命令加 `yarn workspace`；扩展包边界一节 |
| `docs/features/README.md` | 挂上 monorepo feature |
| `docs/type-system.md` | 「扩展包」短节 + Mongo TypeName 表（或链到 `tason-mongodb` README） |
| 根 `README.md` | 安装双包示例；ObjectId 依赖说明 |
| `packages/tason-mongodb/README.md` | **用户向**使用说明（可随 npm 发布） |
| 本 plan | 进度勾选 |

用户文档只写 **怎么用**；目录迁移细节与排期只留在本 feature 包。

---

## 8. 固定决策（变更需改本文）

1. **Yarn workspaces** + `packages/*`；核心目录名 `packages/tason`，npm 名不变。  
2. 扩展包 npm 名 **`tason-mongodb`**；注册 API **`registerMongoDBTypes(registry, options?)`**。  
3. BSON 依赖用 **`bson` peer**，不用整包 `mongodb` 作为硬依赖。  
4. **ObjectId 新 TypeName**；Long / Decimal128 **鸭子到现有 TypeName**，不替换默认 parse 实现。  
5. **不覆盖** 核心 `Timestamp`（毫秒）语义。  
6. Mongo 类型 **不进** `packages/tason/src/types` 默认表。  
7. `docs/` 留在仓库根；feature 进度在 `docs/features/monorepo/`。  
8. Mongo「默认用 Long」依赖核心 **3a**（`setDefaultType` / `asDefault`），**不**依赖完整 3b（`parseAs`）。3b 后置补文档即可。  
9. 仅鸭子、不改默认：可用现有 `registerType` push；不推荐作为 Mongo 优先应用的唯一模式。

---

## 9. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 路径别名 / jest 迁包后挂 | 阶段 A 先只迁 core，测试全绿再开 B |
| 扩展 import 不到 `defineType` | B.1 导出审计 |
| `Decimal128` / `UUID` 双实现混淆 | 文档写清默认 parse vs stringify 鸭子；测试 M5 |
| BSON Timestamp 与核心 Timestamp | 禁止同名覆盖；P2 另名 |
| 发布配错 `files` / 主入口 | 每包独立 `files: ["lib"]` + 本地 pack 检查 |
| Yarn Classic workspaces 与 peer | 用 devDependency 链到 workspace 协议 `tason@*` 联调 |
| 双份 `bson` 导致 `instanceof` 失败 | peer + 文档对齐版本；测试 M8；勿在包内 bundle bson |
| 用户 stringify 整个 Mongoose Document | 文档要求 `toObject`/`lean`；不把 Document 当 plain object 承诺 |
| Schema `BigInt` vs `Long` 混淆 | 文档对照表：bigint 走核心，Long 走 Mongo 包 |

---

## 10. 进度勾选

### 阶段 A — Monorepo

- [x] A.1 根 workspaces
- [x] A.2 迁入 `packages/tason`
- [x] A.3 tsconfig / jest 路径
- [x] A.4 gitignore
- [x] A.5 根 scripts
- [x] A.6 build + test 绿（脚手架落地时验证）
- [x] A.7 AGENTS / README
- [x] A.8 发布路径备忘（`packages/<name>` 下 publish；见 AGENTS §2）

### 阶段 A′ — 核心 3a 默认实现

- [ ] A′.1 `setDefaultType` / `asDefault`
- [ ] A′.2 测试 D0–D0d + clone
- [ ] A′.3 导出与文档勾选

### 阶段 B — 扩展骨架

- [ ] B.1 核心导出审计（实现 `registerMongoDBTypes` 前再做）
- [x] B.2 `tason-mongodb` 包脚手架（package / tsconfig / jest / 空 `src/index.ts`）
- [ ] B.3 `registerMongoDBTypes` + `defaultImplementations` 选项（**未实现**，后续细化）
- [x] B.4 包 README（脚手架说明 + 计划 API）
- [ ] B.5 联调编译（依赖实现后补）

### 阶段 C — P0

- [ ] C.1 ObjectId
- [ ] C.2 Long → Int64 鸭子 + 可选默认
- [ ] C.3 Decimal128 鸭子 + 可选默认
- [ ] C.4 type-system 交叉链接
- [ ] C.5 根 README 示例

### 阶段 D — P1 / 发布

- [ ] D.1 Binary 等
- [ ] D.2 版本与首次发布
- [ ] D.3 CI
- [ ] D.4 plan 收尾

---

## 11. 建议实施顺序（一句话）

**先 A 搬核心 → A′ 核心 3a 默认实现 → B 扩展空壳 → C ObjectId/Long/Decimal128（含 defaultImplementations）→ D 发布与 Binary。**

阶段 **3b**（`parseAs`）可与 C/D **并行或后置**；Mongo「默认 Long」只硬依赖 **3a**，不依赖完整阶段 3。

---

## 相关链接

- [runtime-type README](../runtime-type/README.md)（TypeName ↔ 多 RuntimeType）  
- [phase-3-duck-types](../runtime-type/phase-3-duck-types.md)  
- [type-system.md](../../type-system.md)  
- C#：`TASON.Types.SystemTextJson` 的 `AddSystemTextJson` 注册模式  
