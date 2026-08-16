# Monorepo 与 MongoDB 扩展包 — 实施计划

> **状态：阶段 A + B + C1 + C2 + C3 已完成；C4（依赖 runtime-type phase-4 数值协议）与 C 集成测试、阶段 D 待做**  
> 概念入口：[README.md](./README.md)  
> 类型清单：[phase-c-bson-types.md](./phase-c-bson-types.md)  
> 姊妹实现：`E:\dev\VS2022\tason-net`（`TASON` + `TASON.Types.*` + `TASON.AspNetCore`）

本文件只跟踪 **仓库结构** 与 **`tason-mongodb`**。  
核心 `asDefault` / `parseAs`、文档 `_t` 的进度不在这里勾选。

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
| 完整 MongoDB 驱动封装 | 只做 **TASON TypeName ↔ BSON 值** 的序列化 / 反序列化 |
| **对象图 `_t` / toDocument / fromDocument** | **禁止** 放进 `tason-mongodb`。语义见 [polymorphic-persistence](../polymorphic-persistence/)（职责划分，不是本 plan 的前置） |
| 一次迁完所有未来扩展 | 只落地 MongoDB 包；约定留好即可（JSON 库扩展、AspNet 对等物等后续） |
| 核心多实现 / schema 语义 | 不在本 plan 实现。`replaceDefaultImplementation` 使用核心已有的 `asDefault` 等 API |
| Turborepo / Nx / Changesets 一上来全套 | 首期 workspaces + 脚本即可；发布编排可二期 |

---

## 1. 背景与决策依据

### 1.1 现状

| 项 | 当前 |
| --- | --- |
| 包 | Yarn Workspaces：`packages/tason` + `packages/tason-mongodb` |
| 工具 | Yarn Classic（1.22）、`tsc` + `tsc-alias`、Jest、核心 `@/*` → `src/*` |
| 扩展点 | `registerType` / `asDefault` / `setDefaultType*` / `parseAs`；扩展包 `registerMongoDBTypes` |
| 内置类型 | 数字、Date*、RegExp、UUID、Buffer、JSON*、Dictionary 等（见 `packages/tason/src/types/`） |
| Mongo | C1–C3 TypeInfo 已填、A / B 层测试绿；C4（依赖 runtime-type phase-4）与 C 集成测试未做 |

### 1.2 为何 monorepo 而不是多仓库

- 扩展包与核心需要经常对齐同一套语义（TypeInfo 形状、Registry API、Handling 选项）。
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
| `tason` | **peerDependency**（版本区间与核心 semver 对齐，如 `^1.1.0`）；devDependency 用 workspace 协议引用，方便联调 |
| 领域库（如 `bson`） | **peerDependency**（可选 / 必选写清）；扩展包不强制用户装完整 `mongodb` 驱动，优先 `bson` |
| 核心内部路径 | **禁止** `tason/lib/...` 深路径；只依赖公开 API（`defineType`、`TASONTypeRegistry`、类型导出） |

### 3.2 公开 API 形状（已落地）

```ts
// packages/tason-mongodb/src/index.ts
import type { TASONTypeRegistry } from "tason";

/** 类型实现表（便于测试与高级定制）。同一 TypeName 可挂多条（如 UUID 含 Binary subtype 3/4） */
export const MongoTypes: Record<MongoTypeName, MongoTypeInfos>;

/**
 * 向 registry 注册本包全部（或 `include` 指定的）类型。
 * 对齐 C#：TasonTypeRegistry.AddSystemTextJson(...)
 */
export function registerMongoDBTypes(
  registry: TASONTypeRegistry,
  options?: RegisterMongoDBTypesOptions,
): TASONTypeRegistry;

export type RegisterMongoDBTypesOptions = {
  /**
   * 是否将 bson.Long / Decimal128 等设为对应内置 TypeName 的 **默认实现**
   *（核心 `registerType(..., { asDefault })`）。
   * - 缺省 / false：仅追加类型实现（parse 仍用核心默认；stringify 可识别实例）
   * - true：对可映射项全部替换默认
   * - 对象：按 TypeName 细开（仅 catalog 中 `canReplaceDefault` 的 append 项生效）
   */
  replaceDefaultImplementation?: boolean | ReplaceDefaultImplementationMap;
  /** 选择性注册；默认全部 */
  include?: MongoTypeName[];
};
```

另导出：`MongoTypeCatalog` / `ALL_MONGO_TYPE_NAMES` / `mongoTypeInfoList`，类型 `MongoTypeName` / `MongoTypeSpec` / `MongoTypeStrategy` / `MongoTypeInfos` / `ReplaceDefaultImplementationMap`（细开键：`Int64` / `Decimal128` / `Int32` / `Float64` / `UUID` / `Buffer`）。  
命名历史：早期草案的 duckOntoBuiltins / defaultImplementations 已废止，定名 `replaceDefaultImplementation`。

**用法（已写入包 README）：**

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
registerMongoDBTypes(s.registry);

s.parse(`{ _id: ObjectId("6670f391dcb0bd791cb3bd18") }`);
```

不强制改核心增加 `serializer.use(plugin)`；若后续多扩展需要插件链，可另开 issue。首期 **函数式注册** 足够，也和 C# 扩展方法同一结构。

### 3.3 注册策略

| 策略 | 说明 |
| --- | --- |
| **新增 TypeName** | 如 `ObjectId`、`MinKey`：`registerType` 即可 |
| **追加类型实现（挂到已有 TypeName）** | 如 bson `Long` → `Int64`：`registerType("Int64", longTypeInfo)`（push）。parse **仍 core 默认**；stringify 时 `instanceof` 命中 |
| **替换默认实现（推荐 Mongo 优先）** | 核心 `asDefault` / `setDefaultType`；本包选项 **`replaceDefaultImplementation`**。parse `Int64("…")` → `bson.Long` |
| **别名** | 如需要 `Long` 作为独立 TypeName：`registerTypeAlias` 或单独 scalar（**二选一**，避免双语义） |
| **幂等** | 核心 `registerType` 按 ctor 幂等更新，同一 registry 重复调用不堆积 |

本包用到的核心 API（语义以 runtime-type 为准，进度不在本文件勾选）：

| 能力 | 核心 API | Mongo 用法 |
| --- | --- | --- |
| 追加类型实现 + stringify 认实例 | `registerType` push | 纳入 `include` 即注册到对应 TypeName |
| 替换默认实现 | `asDefault` / `setDefaultType` | **`replaceDefaultImplementation`** |
| 单次选型 | `parseAs` / `getTypeInfoByCtor` | 应用层可选；包内不强制 |

`registerMongoDBTypes` 骨架已按此 API 落地。**C1 / C2 / C3 TypeInfo 已填入 `MongoTypes`**。

### 3.4 核心需保证的公开导出（迁包时核对）

扩展包至少需要能 import：

- `defineType` / `TASONTypeInfo`
- `TASONTypeRegistry`（类型 + 实例方法）
- 若扩展需要与 Handling 交互：`TASONSerializerOptions` 相关类型

**检查项（B.1 已核对补齐）：** `defineType` / `TASONTypeInfo` / `TASONTypeRegistry` / `RegisterTypeOptions` 均已自 `tason` 命名导出。

扩展通过 `serializer.registry` 拿到实例即可，**不必**要求用户 `new Registry`。

---

## 4. MongoDB 包：类型范围

### 4.0 生态调研：BSON 运行时到底是什么

Node 侧 Mongo 生态几乎都收敛到官方 **`bson` / `mongodb` 捆绑的 BSON 类**，而不是各插件自造值类型。TASON 扩展只要 **ctor 与应用里的是同一份类**（`instanceof` 成立），就能对「驱动 / Mongoose 文档字段」生效；**不会**自动接入 SchemaType 注册或 cast 管线。

| 库 / 层 | 做法 | 文档字段上的 RuntimeType |
| --- | --- | --- |
| **`bson` / `mongodb` 驱动** | 权威实现；`ObjectId`、`Long`、`Decimal128`、`Binary`、`Double`、`Timestamp`、`UUID`… 均从此包（或 `mongodb` 再导出） | 读写文档时即为这些类的实例 |
| **`mongoose-long`** | **不**另造 Long：`Types.Long = mongoose.mongo.Long`；自定义 `Schema.Types.Long` 只做 **cast**（`fromNumber` / `fromString` / `instanceof mongo.Long`） | 路径上是 **`bson.Long`（即 driver Long）** |
| **Mongoose 内置** | `Types.Decimal128` **直接 re-export** `mongodb` 的 BSON Decimal128；`Types.ObjectId` 同族；`Schema.Types.*` 是配置，**不是**值类型 | ObjectId / Decimal128 等为 BSON 实例 |
| **Mongoose `BigInt` SchemaType** | 存库为 BSON long，**内存为原生 `bigint`** | **不是** `Long` 实例 → 走核心 `bigint` / Int64 路径，不是 Mongo Long 的追加类型实现 |
| **Mongoose `Int32` / `Double`** | Int32 常为 **number**；Double 常为 **`bson.Double` 包装** | 与「裸 number」不完全同一 |
| **Mongoose UUID** | BSON Binary subtype 4；访问时可能 getter 成 **string** | ser 前注意是 Binary 还是 string |
| **Typegoose 等** | 建立在 Mongoose 之上，值类型仍是 `mongoose.Types.*` / bson | 同 Mongoose |
| **EJSON / Extended JSON** | 文本形态 `{"$oid":"…"}` 等，**不是** TASON | 不互通；若需要可另做转换层，不进本包 P0 |

**对 `tason-mongodb` 能否「对这些库生效」的判定：**

| 场景 | 能否生效 | 条件 / 注意 |
| --- | --- | --- |
| `stringify` 查询结果 / `lean()` 文档中的 `ObjectId`、`Long`、`Decimal128` | **能** | 注册对应 TypeInfo，且 **`instanceof` 命中**（同一 bson 副本） |
| `parse` 出上述类型再 `insertOne` / 赋给 mongoose 路径 | **能** | `replaceDefaultImplementation` 将默认设为 BSON 类，或业务侧接受 cast；`mongoose-long` 的 `cast` 也认 `instanceof mongo.Long` |
| 未 `registerMongoDBTypes` 就 parse `ObjectId("…")` | **不能** | 核心无 ObjectId |
| 直接 `stringify(mongooseDocument)` 整棵 Document | **部分** | Document 有原型/内部状态；**推荐 `doc.toObject()` / `lean()`** 后再 stringify |
| Schema 声明为 `BigInt` 的字段 | **靠核心** | 值是 `bigint`，用核心 number handling / Int64，不必 Mongo Long 的追加类型实现 |
| 双份 `bson`（nested node_modules） | **易失效** | `instanceof` 失败 → stringify 无法识别、parse 得到的类驱动也无法识别。**强制 peer `bson`，文档要求与 `mongodb`/`mongoose` 使用同一份 `bson`** |
| 插件自定义 SchemaType 但值仍是 bson 类 | **能** | 与 mongoose-long 同模式 |
| 插件自造 **非 bson** 的包装类 | **默认不能** | 需再追加类型实现或适配；本包不承诺兼容所有插件 |

**设计推论（固定）：**

1. TypeInfo 的 `ctor` **优先使用 `bson` 包导出**（`ObjectId`、`Long`、`Decimal128`…），不要自建平行类。  
2. `peerDependencies`：`bson`（及文档说明：与项目中 `mongodb` / `mongoose` 解析到的 bson 一致）。可选说明也可 `import { Long } from "mongodb"`，但 monorepo 实现侧统一从 `bson` import，避免分叉。  
3. **不为 mongoose-long 写专用适配**；兼容其文档字段就是兼容 `bson.Long`。  
4. README 写清：对 Mongoose 先 `toObject({ flattenMaps: true })` 等再交给 TASON；BigInt Schema 不是 Long 的追加类型实现。  
5. 双份 `bson` 的危害写进风险表与测试：可用集成测试验证「从 mongoose 取出的 ObjectId 能被 registry 识别」。

### 4.1 类型清单与适配（细则见分册）

官方清单、序列化/反序列化映射、选型分支只写在：

**[phase-c-bson-types.md](./phase-c-bson-types.md)**（四张表）

此处只列出本 plan 需要固定的结论：

1. TypeName 语言无关；运行时 **`bson` 官方类**，不自建平行类。
2. 能复用核心 TypeName 的就追加；BSON Timestamp **必须**用 `BSONTimestamp`，不得覆盖核心毫秒 `Timestamp`。
3. 不注册废弃类型（undefined / DBPointer / BSON Symbol / code-with-scope）。
4. 不发明 BSON 类型码；用户扩展走已有类型或 `binData` 子类型 128–255。
5. 不在本包做 Mongoose SchemaType / `_t`。

### 4.2 P0 文本（与分册表 2 / 3 一致）

| TypeName | 示例 |
| --- | --- |
| `ObjectId` | `ObjectId("6670f391dcb0bd791cb3bd18")` |
| `Int64`（`bson.Long`） | `Int64("6571037680684232705")` |
| `Decimal128` | `Decimal128("114514.1919")` |

### 4.3 测试分层（`packages/tason-mongodb/test`）

不抄核心数值全矩阵。A / B / 注册入口已随 C1–C3 落地；C 集成未做。

| 层 | 文件 | 测什么 | 状态 |
| --- | --- | --- | --- |
| **A 类型** | `types.test.ts` | 每个 TypeName：parse / stringify 往返；与对应 `bson` 类互转（`instanceof`、`_bsontype` / `sub_type`）；未 register 时新 TypeName 失败 | 已落地 |
| **B 配置** | `options.test.ts` | `include`、`allowUnsafeTypes`、`replaceDefaultImplementation`；Handling × bson 数值类；驱动 `promoteValues` / `promoteLongs` / `promoteBuffers` / `useBigInt64`。矩阵与覆盖编号见 [phase-c §5](./phase-c-bson-types.md) | 已落地 |
| 注册入口 | `register.test.ts` | catalog 命名 / `Buffer` 追加实现不动默认 / 未知 `include` 抛错 | 已落地 |
| **C 集成** | `integration.test.ts`（待建） | 真实 `mongodb` 连接，或 mongoose `lean()` / `toObject()` 文档中的 ObjectId / Long / Decimal128 / UUID / Binary。无连接则 skip，不强制 CI 必装 | 未做 |

依赖：workspace `tason`；`bson` 为 devDependency。集成分层再加 `mongodb` / `mongoose`（dev，可选）。

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

### 前置条件（已满足，不属于本 plan）

`replaceDefaultImplementation` 需要核心已提供：

- `registerType(..., { asDefault })`
- `setDefaultType` / `setDefaultTypeByCtor`
- `getTypeInfoByCtor` / `parseAs`

这些 API 属于 runtime-type 阶段 3，**进度不在本文件勾选**。当前核心已具备，阶段 B / C 可以直接用。

### 阶段 B — 扩展约定落地 + MongoDB 骨架

| # | 任务 |
| --- | --- |
| B.1 | 核对并补齐核心公开导出（`defineType`、`setDefaultType` 等） |
| B.2 | `packages/tason-mongodb`：package.json（peer: `tason`, `bson`）、tsconfig、jest |
| B.3 | `registerMongoDBTypes` 空实现 + 导出表结构 + `replaceDefaultImplementation` 选项形状 |
| B.4 | 包 README：安装、register 示例、**替换默认 vs 仅追加类型实现** |
| B.5 | 工作区联调：core 改 API 时 extension 编译失败应可见 |

**DoD：** 包可 build；register 空操作不破坏 registry；至少 1 个 smoke test。

### 阶段 C — TypeInfo（三步）

命名与映射：[phase-c-bson-types.md](./phase-c-bson-types.md)。下表是当时的实施分步（运行时 catalog 不再带步骤字段）。

**命名：** 仅 BSON 内部语义的 TypeName 以 **`BSON`** 开头（同核心 `JSONObject`）；通用名不加前缀。  
`BSONTimestamp` / `BSONMinKey` / `BSONMaxKey` / `BSONJavaScript` / `BSONEncrypted` / `BSONSensitive` / `BSONVector`。  
`ObjectId`、`Int64`、`Decimal128`、`Int32`、`Float64`、`UUID`、`Buffer`、`MD5` 不加前缀。

#### C1 — 注册约定 + 简单新类型

| # | 任务 |
| --- | --- |
| C1.1 | 按 catalog 中 C1 条目注册新 TypeName；确认 `include` / `allowUnsafeTypes` 对它们生效 |
| C1.2 | `ObjectId` TypeInfo |
| C1.3 | `BSONMinKey` / `BSONMaxKey`（无载荷标量） |
| C1.4 | `BSONTimestamp` ObjectType `{ t, i }`；不得占用核心 `Timestamp` |
| C1.5 | `BSONJavaScript`（`Code`；仅 `allowUnsafeTypes`） |
| C1.6 | **A 类型测试**覆盖 C1 各 TypeName；**B** 覆盖 `include` / unsafe |

**DoD：** 新 TypeName 可 parse / stringify；实例为对应 `bson` 类；未开 unsafe 时 `BSONJavaScript` 不登记。

#### C2 — 内置标量的鸭子类型追加（含 UUID）

| # | 任务 |
| --- | --- |
| C2.1 | `Long` → `Int64`；`match` 排除 `bson.Timestamp` |
| C2.2 | `bson.Decimal128` → `Decimal128` |
| C2.3 | `bson.Int32` → `Int32`；`bson.Double` → `Float64` |
| C2.4 | `bson.UUID`（及 Binary subtype 3/4）→ `UUID` |
| C2.5 | **A** 各追加项 stringify 能识别实例、parse 默认仍为核心；**B** 重点测 `replaceDefaultImplementation` 与 Handling / `promoteLongs` 等组合 |

**DoD：** 未换默认时 parse 仍为核心包装；`replaceDefault: true` 或按名打开后 parse 得 `bson` 类；`parseAs` 单次可选。

#### C3 — Binary 子类型

| # | 任务 |
| --- | --- |
| C3.1 | `Buffer` 追加 `Binary`（剩余 subtype）；`match` 排除 3/4/5/6/8/9 |
| C3.2 | `MD5` / `BSONEncrypted` / `BSONSensitive` / `BSONVector` |
| C3.3 | **A** 按 subtype 写出对应 TypeName；**B** `promoteBuffers` 等边界。**C 集成**（真实驱动 / mongoose）需额外环境，不在本步做 |

**DoD：** `Binary` 共用基类选型与分册 §4.1 一致；加密 / 向量往返保住 subtype。

用户文档（`type-system.md` 短节、根 README ObjectId 示例、包 README）已随 C1 落地，不单列阶段。

### 阶段 C4 — bson 数值类接入统一数值实现协议（依赖 runtime-type phase-4）

**前提：** 核心「统一数值实现协议」（数值 TypeName 实现的统一契约 `TASONTypeInfo.unwrapNumber`、核心单轨化、多实现共存）由 runtime-type feature 实施——设计见 [runtime-type/phase-4-number-protocol.md](../runtime-type/phase-4-number-protocol.md)，进度在该 feature 的 implementation-plan 勾选，**不在本文件**。协议落地后执行本阶段，并按分册 [§6 差异表](./phase-c-bson-types.md) 回改 §5.2 / §5.3 矩阵。

| # | 任务 |
| --- | --- |
| C4.1 | 前置确认：runtime-type phase-4 已实施（钩子字段 + 注册校验可用） |
| C4.2 | 本包：`Int64` / `Int32` / `Float64` / `Decimal128` 四个 bson TypeInfo 声明钩子（Long → `toBigInt()`，禁 `valueOf`） |
| C4.3 | 测试：M6 按分册 §6 差异表重写（ser 三档、de `native` 拆 bson 类、`all` 保留、replace 后仍拆） |
| C4.4 | 文档同步：分册 §5.2 / §5.3 矩阵改为协议后行为、§6 差异表标记已落地、包 README「Handling」段 |

**DoD：** 分册 §6 差异表全部转为现行行为并合入 §5.2 / §5.3；`none` 不再对 bson 类抛错；`native` 拆 `Long` → `bigint`；`all` 保 bson 类。

### 阶段 D — 发布与文档抛光

| # | 任务 |
| --- | --- |
| D.1 | 版本策略：core 与 mongodb **独立 semver**；mongodb 初始 `0.1.0` 或 `1.0.0-beta` |
| D.2 | CI（若有）：matrix 构建两个包；集成测试用 path / 环境变量跳过 |
| D.3 | 本 plan 勾选进度；features/README 状态更新 |

**后置（不阻塞首发）：** Changesets、`parseAs` 使用示例。

---

## 6. 版本与发布

| 策略 | 选择 |
| --- | --- |
| 版本号 | **独立版本**（core `1.x`，mongodb 自 `0.x`/`1.x` 起） |
| 兼容 | mongodb 的 `peerDependencies.tason` 声明支持的 core 范围 |
| 发布顺序 | 先 core（若有 API 导出补丁），再 mongodb |
| 锁文件 | 单根 `yarn.lock` |

对已发布包的影响：monorepo **本身**对只 `npm i tason` 的用户无影响；仅贡献者克隆后的路径变化。

---

## 7. 文档与 Agent 约定变更清单

| 文档 | 变更 | 状态 |
| --- | --- | --- |
| `AGENTS.md` | 源码地图改为 `packages/tason/src`；命令加 `yarn workspace`；扩展包边界一节 | 已完成 |
| `docs/features/README.md` | 加入 monorepo feature 索引 | 已完成 |
| `docs/type-system.md` | 「同一 TypeName 的多种实现」+「扩展类型」短节（链到包 README） | 已完成 |
| 根 `README.md` | 仓库结构；ObjectId 依赖 `tason-mongodb` | 已完成 |
| `packages/tason-mongodb/README.md` | 面向用户的使用说明（C1 / C2 / C3 已写） | 已完成 |
| 本 plan | 进度勾选（§10；A / B / C1–C3 已完成，C 集成与 D 待做） | 持续更新 |

用户文档只写 **怎么用**；目录迁移细节与排期只留在本 feature 包。

---

## 8. 固定决策（变更需改本文）

1. **Yarn workspaces** + `packages/*`；核心目录名 `packages/tason`，npm 名不变。  
2. 扩展包 npm 名 **`tason-mongodb`**；注册 API **`registerMongoDBTypes(registry, options?)`**。  
3. BSON 依赖用 **`bson` peer**，不用整包 `mongodb` 作为硬依赖。  
4. **ObjectId 新 TypeName**；Long / Decimal128 **追加类型实现到现有 TypeName**；是否替换默认由 **`replaceDefaultImplementation`** 控制。  
5. **不覆盖** 核心 `Timestamp`（毫秒）语义。BSON 内部类型 TypeName 以 **`BSON`** 开头（`BSONTimestamp`、`BSONMinKey`、`BSONMaxKey`、`BSONJavaScript`…）。通用名不加前缀。  
6. Mongo 类型 **不进** `packages/tason/src/types` 默认表。  
7. `docs/` 留在仓库根；feature 进度在 `docs/features/monorepo/`。  
8. Mongo 类型实现使用核心已有的 `asDefault` 等 API；包选项名 **`replaceDefaultImplementation`**。  
9. 仅追加类型实现、不改默认：`registerType` push；Mongo 优先的应用应打开 `replaceDefaultImplementation`。  
10. **不发明 BSON 类型码**。库侧用户扩展用 `binData` 子类型 128–255；TASON 文本走 `Buffer`，**不保留 subtype**。业务文档类型走 `_t`，不进本包。  
11. BSON Timestamp 的 TypeName 固定为 **`BSONTimestamp`**；`Long` 实现必须排除 `bson.Timestamp`（该类继承 `Long`）。  
12. `binData` **按 subtype 拆**（C3）：UUID 在 C2 追加；MD5 / `BSONEncrypted` / `BSONSensitive` / `BSONVector` 独立；其余走核心 `Buffer`。**不**登记 DBRef。  
13. 阶段 C 分四步：**C1** 新类型（ObjectId / Min·Max / Timestamp / JavaScript）→ **C2** 内置标量鸭子类型追加（含 UUID）→ **C3** Binary 子类型 → **C4** bson 数值类接入统一数值实现协议（依赖 runtime-type phase-4）。
14. bson 数值类的 Handling 行为以 [分册 §6 差异表](./phase-c-bson-types.md) 为准：现行只认核心包装；协议（`unwrapNumber`）落地后 de `native` 拆 bson 类，且拆箱优先于 `replaceDefaultImplementation`（要保留 bson 类用 `deserializeNumberHandling: "all"` 或 `parseAs`）。协议本体的设计在 [runtime-type/phase-4-number-protocol.md](../runtime-type/phase-4-number-protocol.md)，不在此维护。
15. `BSONTimestamp` 固定为 **object 形式** `{t, i}`，**不**随 `bson.Timestamp extends Long` 统一为 scalar 十进制串：文本形式跟 TypeName 的跨语言语义（(seconds, increment)，EJSON 同构），不跟 JS 继承链；继承只影响实例识别（`match` 拆分，见分册 §4.1）。

---

## 9. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 路径别名 / jest 迁包后失效 | 阶段 A 先只迁 core，测试全绿再开 B |
| 扩展 import 不到 `defineType` | B.1 导出审计 |
| `Decimal128` / `UUID` 双实现混淆 | 文档写清默认 parse vs 追加类型实现后的 stringify；测试 M5 |
| BSON Timestamp 与核心 Timestamp | 禁止同名覆盖；P2 另名 |
| 发布配错 `files` / 主入口 | 每包独立 `files: ["lib"]` + 本地 pack 检查 |
| Yarn Classic workspaces 与 peer | 用 devDependency 链到 workspace 协议 `tason@*` 联调 |
| 双份 `bson` 导致 `instanceof` 失败 | peer + 文档要求使用同一份 `bson`；测试 M8；勿在包内 bundle bson |
| 用户 stringify 整个 Mongoose Document | 文档要求 `toObject` / `lean`；不要承诺可以把 Document 当 plain object |
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

### 前置条件

- 核心 `asDefault` / `setDefaultType*` / `parseAs` / `getTypeInfoByCtor` 已可用（runtime-type 工作，不在本 plan 勾选）

### 阶段 B — 扩展骨架

- [x] B.1 核心导出审计（`defineType` / `TASONTypeRegistry` / `setDefaultType*` / `parseAs` / `RegisterTypeOptions`）
- [x] B.2 `tason-mongodb` 包脚手架（package / tsconfig / jest）
- [x] B.3 `registerMongoDBTypes` + `MongoTypes` / `MongoTypeCatalog` + `replaceDefaultImplementation`（TypeInfo 空表，阶段 C 填入）
- [x] B.4 包 README（安装、register、替换默认 vs 仅追加）
- [x] B.5 联调编译（扩展包 import 核心公开 API；`yarn workspace tason-mongodb build` / `test`）

### 阶段 C — TypeInfo

- [x] C.0 清单与映射（[phase-c-bson-types.md](./phase-c-bson-types.md)）；命名改为 `BSON*` 前缀规则
- [x] C1 注册 + `ObjectId` / `BSONMinKey` / `BSONMaxKey` / `BSONTimestamp` / `BSONJavaScript` + A/B 测试
- [x] C2 `Int64` / `Decimal128` / `Int32` / `Float64` / `UUID` 追加 + replaceDefault 配置测试
- [x] C3 Binary 子类型 + A/B 测试（C 集成测试需额外环境，暂缓）
- [ ] C4 bson 数值类接入统一数值实现协议（依赖 [runtime-type phase-4](../runtime-type/phase-4-number-protocol.md)；差异表：[phase-c §6](./phase-c-bson-types.md)）

### 阶段 D — 发布

- [ ] D.1 版本与首次发布
- [ ] D.2 CI
- [ ] D.3 plan 收尾

---

## 11. 建议实施顺序（一句话）

**A / B / C1–C3 已完成 → C4 接入数值协议（依赖 runtime-type phase-4 实施）→ C 集成测试（需真实驱动环境，暂缓）→ D 发布。**

---

## 相关链接

- 官方 BSON 清单与适配：[phase-c-bson-types.md](./phase-c-bson-types.md)
- 核心多实现 API 说明：[phase-3-duck-types](../runtime-type/phase-3-duck-types.md)（只作 API 参考，不跟踪其进度）
- [type-system.md](../../type-system.md)
- C#：`TASON.Types.SystemTextJson` 的 `AddSystemTextJson` 注册模式
