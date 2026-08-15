# AGENTS.md — TASON (JS/TS)

本仓库是 **TASON**（Type-Augmented Serialization Object Notation）的 JavaScript/TypeScript 实现。  
面向 agent / 协作者：约定、边界与入口；**行为与决策细节以 `docs/` 为准**，勿在本文件重复展开。

姊妹实现（语义参考，非本仓库）：**.NET / C#** → `E:\dev\VS2022\tason-net`（GitHub: [tason-net](https://github.com/SwingCosmic/tason-net)）。

---

## 1. 项目是什么

- **TASON** = JSON5 风格文本 + **自描述 TypeName**（`Int64("1")`、`User({…})`）。
- **Monorepo**（Yarn Workspaces）：核心包 `tason` + 扩展包（首个 `tason-mongodb`）。
- 语法：`packages/tason/src/grammar/TASON.g4`（ANTLR4）；生成物同目录；编译产物在各包 `lib/`。
- 运行时：`TASONSerializer` + `TASONTypeRegistry` + 内置 `types/`。
- 当前主线 feature：**runtime-type**（数值 Handling · ClassMetadata/schema · 鸭子类型）；结构见 **monorepo** / **polymorphic-persistence** 文档。

### 文档入口

**用户文档（使用说明，对外）：**

| 路径 | 用途 |
| --- | --- |
| [README.md](./README.md) | 产品简介与快速上手 |
| [docs/type-system.md](./docs/type-system.md) | 类型系统规范 |
| [docs/number-handling.md](./docs/number-handling.md) | 数值处理（使用） |
| [docs/class-metadata.md](./docs/class-metadata.md) | 实体 Schema（使用） |
| [docs/regexp.md](./docs/regexp.md) | RegExp |
| [packages/tason-mongodb/README.md](./packages/tason-mongodb/README.md) | Mongo 扩展（注册骨架已就绪；P0 类型待阶段 C） |

**实现资料（设计/进度，对内；勿链进用户 README 当手册）：**

| 路径 | 用途 |
| --- | --- |
| [docs/features/glossary.md](./docs/features/glossary.md) | 术语与用语（RuntimeType / TypeName / 字面量 / 鸭子类型） |
| [docs/features/runtime-type/](./docs/features/runtime-type/) | 当前 feature 包 |
| ↳ [implementation-plan.md](./docs/features/runtime-type/implementation-plan.md) | 进度 + 固定决策 |
| ↳ design / phase-1 / phase-2 / phase-3 | 设计与分阶段任务 |
| [docs/features/monorepo/](./docs/features/monorepo/) | Workspaces · 扩展包约定 · `tason-mongodb` |
| [docs/features/polymorphic-persistence/](./docs/features/polymorphic-persistence/) | 文档 `_t` 中间层（与 BSON 标量包分开维护） |

三个 feature 的进度各自独立，归属与交叉引用约定见 [docs/features/README.md](./docs/features/README.md)。  
面向用户的文档只写**怎么用**；方案与排期只放在 `docs/features/`。

---

## 2. 常用命令

```bash
yarn install
yarn build                    # 所有 workspace build
yarn test                     # 所有 workspace test
yarn generate                 # 仅改了 TASON.g4 时（核心包）

yarn workspace tason build
yarn workspace tason test
yarn workspace tason-mongodb build

# 在 packages/tason 下也可：
npx jest --testPathPattern=number-handling
npx jest --testPathPattern=runtime-schema
npx jest --testPathPattern=multi-implementation
```

- 路径别名（核心包）：`@/*` → `packages/tason/src/*`。
- **PowerShell：** 不支持 `&&`；多条命令用 `;` 或分开跑。不要把 jest 输出管道给会截断的过滤器。
- **发布：** 在对应包目录 `packages/tason` / `packages/tason-mongodb` 执行 `npm publish`（或 yarn）；根包 `private: true` 不发布。

---

## 3. 源码地图

```
tason/                          # 仓库根（private monorepo）
  package.json                  # workspaces: packages/*
  tsconfig.base.json
  AGENTS.md / README.md / docs/
  packages/
    tason/                      # npm: tason（核心）
      package.json
      src/
        index.ts / TASONSerializer.ts / TASONVisitor.ts / TASONGenerator.ts
        TASONTypeRegistry.ts / TASONTypeInfo.ts / TASONSerializerOptions.ts
        metadata/     # ClassMetadata + 装饰器
        schema/       # RuntimeType、adapter、map*；adapters/valibot.ts
        types/        # 仅内置类型实现
        grammar/      # ANTLR 语法与生成代码
      test/           # Jest（见 §6）
      lib/            # build 输出，勿手改
    tason-mongodb/              # npm: tason-mongodb（BSON 标量扩展）
      package.json              # peer: tason, bson
      src/                      # registerMongoDBTypes + MongoTypes 表；TypeInfo 待阶段 C
      test/
      lib/
```

**模块边界（摘要）：** Schema 只描述 RuntimeType；Registry 管 TypeName ↔ 实现；Handling 管装箱/拆箱策略；`types/` 只放核心内置实现。Mongo/BSON **不进** 核心默认表。对象图 `_t` 中间层 **不进** `tason-mongodb`。用语见 [glossary](./docs/features/glossary.md)；包边界见 [monorepo plan](./docs/features/monorepo/implementation-plan.md)。

---

## 4. 概念与功能设计

**不要在本文件复述选项表、优先级、API 清单。** 改相关代码前读：

| 主题 | 文档 |
| --- | --- |
| RuntimeType / Schema / TypeName / TypeInstance / 字面量 / 鸭子类型 | [glossary.md](./docs/features/glossary.md) |
| 设计总览 | [runtime-type-design.md](./docs/features/runtime-type/runtime-type-design.md) |
| 序列化/反序列化 Number Handling（选项名、默认值、ser/de 不对称） | [phase-1](./docs/features/runtime-type/phase-1-number-handling.md) · 设计 §3 · 代码 `packages/tason/src/types/NumberHandling.ts` |
| ClassMetadata、adapter、契约优先级、结构遍历 | [phase-2](./docs/features/runtime-type/phase-2-class-metadata-schema.md) · 代码 `packages/tason/src/schema/`、`metadata/` |
| 鸭子类型 / 默认实现 / `parseAs` | [phase-3](./docs/features/runtime-type/phase-3-duck-types.md) |
| 固定决策与范围外 | [implementation-plan.md](./docs/features/runtime-type/implementation-plan.md) |
| Monorepo / 扩展包 / BSON | [monorepo](./docs/features/monorepo/) |
| 文档 `_t` / toDocument | [polymorphic-persistence](./docs/features/polymorphic-persistence/) |

选项字符串 **kebab-case**。与 .NET 对齐的 ser 选项名（如 `object-type-property`）以文档/代码为准，勿为「JS 对称」擅自重命名。

---

## 5. 与 C# 对齐

- 参考：`E:\dev\VS2022\tason-net`（核心多在 `TASON/`）。
- **语义对齐，手段按语言替换**（CLR 反射 → schema + adapter）。对照表见 [implementation-plan.md](./docs/features/runtime-type/implementation-plan.md)。
- 改 Handling / OT 上下文前，先在 C# 搜对应概念再改 JS。

---

## 6. 测试约定

| 文件（相对 `packages/tason/test/`） | 职责 |
| --- | --- |
| `number-handling.test.ts` | 纯 Number Handling（值级矩阵；OT 仅最简 schema） |
| `runtime-schema.test.ts` | 纯 schema / ClassMetadata / 结构遍历 / builtin |
| `symbol-edge.test.ts` | Symbol 边界 |
| `multi-implementation.test.ts` | 默认实现 / `parseAs` / clone（D0–D7） |
| `parse*.test.ts` / `stringify*.test.ts` | 语法与基础 ser/de |
| `packages/tason-mongodb/test/` | 注册骨架 + 日后 BSON 类型（勿把全量核心矩阵抄过去） |

- **不要**再拆重复 suite（如已删除的 builtins 独立文件）；数值矩阵与 schema 结构测试勿互相抄全量。
- **用例标题**：对象 + 模式/行为；复杂逻辑写行内注释，不写进标题、不写期望结果清单。
- 契约用例须显式 `setSchemaAdapter(createValibotAdapter())`。
- 改 Handling / Visitor / Generator / schema / Registry 默认实现 后至少跑 `number-handling`、`runtime-schema` 与 `multi-implementation`。

---

## 7. 文档约定

- Feature 文档放在 `docs/features/<name>/`，不要堆在 `features/` 根下。
- 三个 feature **进度各自独立**；归属与交叉引用约定见 [docs/features/README.md](./docs/features/README.md)。不要把另一个 feature 的阶段勾进自己的 plan。
- **概念 / 用语**只在 [docs/features/glossary.md](./docs/features/glossary.md) 维护（含鸭子类型与代码标识符）；**进度**只在各 feature 自己的 implementation-plan；分册写细节。
- 行为与文档冲突时：以 **代码 + feature 文档** 为准，并同步文档；**不要**把决策抄进本 AGENTS 当第二真相源。
- 中文文档为主；标识符 / 选项 / TypeName 保持英文原样。专业术语不必强行翻译。避免无限定的机械译（如单独写「冒烟」「水合」）。

---

## 8. 工作习惯与踩坑（流程向）

1. 先读对应 feature 文档与 C# 参考，再改实现；细节不进本文件。
2. 公开 API 变更同步 `packages/tason/src/index.ts`（及扩展包入口）与 feature 文档；进度变更更新对应 implementation-plan。
3. 勿手改 ANTLR 生成逻辑意图；改 `TASON.g4` 后 `yarn generate`。勿改各包 `lib/`。
4. 勿顺手大重构无关文件；阶段边界以**该 feature 自己的** plan 为准（runtime-type 已完成；`tason-mongodb` 的 TypeInfo 在 monorepo 阶段 C 填，且不做 `_t` 打标）。
5. 曾反复踩过、且易在「未读分册」时再犯的点（**细节见 phase 文档**）：
   - 有 schema 契约时与 `object-fallback-*` / OT 上下文的优先级（phase-2）
   - ser/de 选项命名不对称是故意的（phase-1 / 设计）
   - 同质大数组避免 per-element 重复 schema introspect（phase-2）
   - 字面量含义、安全整数不静默截断（[glossary](./docs/features/glossary.md) · phase-2 矩阵）
   - 无 `setSchemaAdapter` 则契约不生效
   - 双份 `bson` 导致 `instanceof` 失效（Mongo 扩展）

---

## 9. 改动自检

- [ ] 已读相关 phase / design，未凭记忆发明选项名或优先级  
- [ ] 测试落在正确文件、标题干净  
- [ ] 相关 jest 绿；导出变更时 `yarn build`（或对应 workspace）  
- [ ] 进度/文档已按需更新  
