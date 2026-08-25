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
- 三个 feature（runtime-type / monorepo / polymorphic-persistence）进度各自独立，归属与入口见 [docs/features/README.md](./docs/features/README.md)。

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

## 3. 仓库结构

```
tason/                          # 仓库根（private monorepo）
  package.json                  # workspaces: packages/*
  tsconfig.base.json
  AGENTS.md / README.md / docs/
  packages/
    tason/                      # npm: tason（核心）
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
      src/                      # registerMongoDBTypes + MongoTypes + TypeInfo
      test/
      lib/
```

**模块边界（摘要）：** Schema 只描述 RuntimeType；Registry 管 TypeName ↔ 实现；Handling 管装箱/拆箱策略；`types/` 只放核心内置实现。Mongo/BSON **不进** 核心默认表。对象图 `_t` 中间层 **不进** `tason-mongodb`。

---

## 4. docs 目录与文档编写规范

- **两层分工**：用户文档（根 `README.md`、`docs/*.md`、各包 `README.md`）只写**怎么用**，不链 `docs/features/` 当手册；方案、设计与排期只放 `docs/features/<name>/`。
- Feature 文档放在 `docs/features/<name>/`，不要堆在根下；**进度**只写各 feature 自己的 implementation-plan，不要把别的 feature 阶段勾进来。
- **概念 / 用语**只在 [glossary.md](./docs/features/glossary.md) 维护；分册写细节，不在多个文档间复制矩阵或决策（需要时链接到单一出处）。
- 行为与文档冲突时：以 **代码 + feature 文档** 为准，并同步文档；**不要**把决策抄进本文件当第二真相源。

### CHANGELOG 编写规范

各发布包维护自己的 `CHANGELOG.md`（`packages/<pkg>/CHANGELOG.md`），随包一起发布。编写要求：

- **只记录面向库用户的内容**：功能性变更、bug 修复、涉及内部实现机制的重大重构。项目结构调整、文档优化、构建流程、单元测试调整等**不写**。
- **按 minor 版本分节**：每个 minor 小节收录「上一个 minor 最新版本 → 该 minor 最新版本」之间的修改；标题格式 `## <minor> — <实际版本号> (<YYYY-MM-DD>)`，如 `## 1.2 — 1.2.2 (2026-08-25)`。
- **以 npm 实际发布为准**：版本号与发布时间用 `npm view <pkg> time --json` 核对，未发布的版本号不写节。
- 描述从简：每个功能点一两句话；有完整用户文档的附相对链接（如 [类型系统](../docs/type-system.md)）。
- **发布时机**：CHANGELOG 必须随本次发布的代码一起提交推送——npm 包一旦发布无法回改，包内 CHANGELOG 落后于线上即永久落后。因此版本号 bump 后、`npm publish` 前，把该次变更写入对应 minor 小节并填上预计发布日期。

---

## 5. 用语与标识符命名

- 文档叙述写完整说法（**序列化 / 反序列化**，不写 ser/de）；术语以 [glossary](./docs/features/glossary.md) 为准。
- 中文文档为主；标识符 / 选项 / TypeName 保持英文原样。专业术语不必强行翻译。
- **禁止机械翻译**（文档、测试标题、行内注释一体适用）。glossary「其它衍生/外部说法」里标了**不得使用**的词（如「水合」，「冒烟」）。新出现的外部译名先入 glossary 再决定能否用。
- 选项字符串 **kebab-case**；与 .NET 对齐的选项名（如序列化侧 `object-type-property`）以文档/代码为准，勿为「JS 对称」擅自重命名；序列化与反序列化选项命名不对称是**故意的**。
- 代码标识符**禁止** `duck` / `DuckType` 等鸭子类型相关，文档不限；对应 API 用 `asDefault` / `setDefaultType` / `setDefaultTypeByCtor` / `parseAs` / `getTypeInfoByCtor` / `replaceDefaultImplementation`。
- **与 C# 对齐**：语义对齐、手段按语言替换（CLR 反射 → schema + adapter）。改 Handling / OT 上下文相关行为前，先在 `E:\dev\VS2022\tason-net`（核心多在 `TASON/`）搜对应概念再改 JS。

---

## 6. 测试约定（拆分与命名）

| 文件（相对 `packages/tason/test/`） | 职责 |
| --- | --- |
| `number-handling.test.ts` | 纯 Number Handling（值级矩阵；OT 仅最简 schema） |
| `runtime-schema.test.ts` | 纯 schema / ClassMetadata / 结构遍历 / builtin |
| `symbol-edge.test.ts` | Symbol 边界 |
| `multi-implementation.test.ts` | 默认实现 / `parseAs` / clone |
| `parse*.test.ts` / `stringify*.test.ts` | 语法与基础序列化/反序列化 |
| `packages/tason-mongodb/test/` | **A** `types.test.ts` 类型序列化/反序列化与 bson 互转；**B** `options.test.ts` 选项组合（尤其 replaceDefault）；**C** `integration.mongodb.test.ts` / `integration.mongoose.test.ts` 原生驱动与 mongoose 集成（共享夹具 `integration.shared.ts`；连接信息 `.env` 占位 / `.env.local`，未配置则 skip）。勿抄核心数值全矩阵 |

- 不拆重复 suite；数值矩阵与 schema 结构测试不互相抄全量。
- **用例标题**：对象 + 模式/行为；复杂逻辑写行内注释，不写进标题、不写期望结果清单。
- 契约用例须显式 `setSchemaAdapter(createValibotAdapter())`。
- 改 Handling / Visitor / Generator / schema / Registry 默认实现后，至少跑 `number-handling`、`runtime-schema` 与 `multi-implementation`。

---

## 7. 工作习惯与常见踩坑

1. 先读对应 feature 文档与 C# 参考，再改实现。
2. 公开 API 变更同步 `packages/tason/src/index.ts`（及扩展包入口）与 feature 文档；进度变更更新对应 implementation-plan。
3. 勿手改 ANTLR 生成物；改 `TASON.g4` 后 `yarn generate`。勿改各包 `lib/`。
4. 勿顺手大重构无关文件；阶段边界以**该 feature 自己的** plan 为准。
5. 反复踩过、易在「未读分册」时再犯的点（细节见 phase 文档）：
   - 有 schema 契约时与 `object-fallback-*` / OT 上下文的优先级（phase-2）
   - 序列化/反序列化选项命名不对称是故意的（phase-1 / 设计）
   - 同质大数组避免逐元素重复 schema introspect（phase-2）
   - 字面量含义、安全整数不静默截断（[glossary](./docs/features/glossary.md) · phase-2 矩阵）
   - 无 `setSchemaAdapter` 则契约不生效
   - 双份 `bson` 会导致 `instanceof` 失效（Mongo 扩展）

---

## 8. 改动自检

- [ ] 已读相关 phase / design 与 glossary，未凭记忆发明选项名或优先级  
- [ ] 测试落在正确文件、标题干净  
- [ ] 相关 jest 绿；导出变更时 `yarn build`（或对应 workspace）  
- [ ] 进度 / 文档已按需更新  
- [ ] 用语已对照 glossary：文档 / 测试标题 / 注释未使用「水合」等标为不得使用的机械翻译  
