# 阶段 3：鸭子类型、默认实现与多态反序列化

> **状态：待办（3a 可先于 monorepo Mongo 落地）**  
> 进度入口：[implementation-plan.md](./implementation-plan.md) · 设计：[runtime-type-design.md](./runtime-type-design.md)  
> 用语：[README 概念对照](./README.md#概念对照读本文档前)  
> 依赖：[阶段 2](./phase-2-class-metadata-schema.md)（建议 2.2 完成后；`parseAs` 可与 2.2 末期并行，但 D4 依赖 schema）  
> 牵动：[monorepo / tason-mongodb](../monorepo/implementation-plan.md)（需要 **3a 默认实现**，不阻塞等完整 3b）

---

## 3.0 目标

同名多实现注册、**指定默认实现**、序列化选型、反序列化在期望类型下选型；与阶段 2 的 schema 层**正交**。

对照 C# Registry 多实现列表；JS 补齐默认实现 API + `registerDuckType` / `parseAs` 与文档对齐。

### 为何拆成 3a / 3b

| 子阶段 | 解决什么 | 谁依赖 |
| --- | --- | --- |
| **3a 默认实现** | parse 无 expected 时用哪一个 `TASONTypeInfo`（今天死写 `types[0]`） | **Mongo 扩展**把 `bson.Long` 设为 `Int64` 默认，避免「parse→核心包装→再塞进驱动」的反复转换 |
| **3b 调用级选型** | `parseAs`、鸭子注册语义打磨、discriminator 对齐 | 单次期望类型 / 文档完整多态，**不**挡 Mongo P0 |

**结论：** 不必整包提前做完阶段 3；**必须**把 3a 从「登记顺序碰巧变成 types[0]」升级为**显式 API**，并在 Mongo 包之前或同步完成。`parseAs`（3b）可仍按原排期。

---

## 3.0a 问题：「蜜汁」反复序列化

当前行为（代码已具备多实现数组，但默认固定）：

| 方向 | 行为 |
| --- | --- |
| **stringify** | `tryGetTypeInfo` / `getType(name, obj)` 按 `instanceof` 命中 → 已注册的鸭子（如 Long）能写出 `Int64("…")` |
| **parse** | Visitor → `getDefaultType` = **`types[0]`**（核心注册顺序下的官方包装） |

因此仅 `registerType("Int64", longInfo)`（push）时：

1. 文本 `Int64("1")` → 得到 **核心** `Int64`，不是 `bson.Long`  
2. 业务/Mongo 驱动侧要 `Long` → 手动转换  
3. 再 stringify：若已是 Long 则鸭子命中；若仍是核心包装则另一路径  
4. 多轮 parse/stringify/写库之间 **运行时类型抖动** → 边界比较、schema `instance(Long)`、驱动 API 易踩坑  

**配置「某 TypeName 的默认实现 = Mongo 类型」** 后：无 expected 的 parse 直接产出 Long，整条链路 RuntimeType 稳定。这与「追加鸭子但不改默认」是**互补**能力，不是 `parseAs` 的替代：

| 能力 | 作用域 | 典型用途 |
| --- | --- | --- |
| **setDefaultType / 注册为默认** | Registry 生命周期内该 TypeName | Mongo 优先应用：全程 Long |
| **parseAs(ctor \| name)** | **单次**调用 | 偶发要 FakeLong / 测试 / 非全局偏好 |
| **仅鸭子 push** | stringify 能认出实例；parse 仍旧默认 | 库内已有 Long 实例、文本侧仍用官方包装 |

---

## 3.1 API

### 3a — 默认实现（优先落地）

```ts
// 将已注册实现提升为 types 列表的默认（getDefaultType）；或传入 typeInfo 先注册再设默认
setDefaultType<T>(name: string, typeInfo: TASONTypeInfo<T>): void
// 或按 ctor 查找同名 entry 内实现后提升
setDefaultTypeByCtor(name: string, ctor: Constructor<unknown>): void

// 可选糖：register 时声明
registerType(name, typeInfo, metadata?, options?: { asDefault?: boolean })
// asDefault: true → unshift / 移到 [0]；false/缺省 → 现有 push（鸭子、不改默认）
```

约束（固定决策候选）：

- `getDefaultType(name)` **唯一**语义来源；Visitor/`createInstance(string)` 只认它。  
- **禁止**依赖「谁先 register」的隐式顺序作为公开约定（builtin 构造顺序除外；扩展包必须显式 `asDefault` 或 `setDefaultType`）。  
- `clone()` 必须**拷贝**默认选择（整表 types 顺序或 defaultIndex）。  
- 设为默认的 typeInfo 必须属于该 TypeName 的 entry（可先 push 再提升）。

Mongo 扩展侧（示意，见 monorepo plan）：

```ts
registerMongoDBTypes(registry, {
  defaultImplementations: {
    Int64: "bson-long",       // 或 true / "prefer"
    Decimal128: "bson-decimal128",
  },
});
// 内部：registerType(..., { asDefault: true }) 或 setDefaultType
```

### 3b — 鸭子注册名与调用级 parse

```ts
// 追加实现；默认不替换 getDefaultType（与 asDefault: false 同义）
registerDuckType(name: string, typeInfo: TASONTypeInfo<T>): void

// 期望类型引导：ctor | 已注册类型名 | 其它描述（实现时定）
parseAs<T>(expected: Constructor<T> | string, text: string): T
```

既有能力复用：

- `types: TASONTypeInfo[]` 已是数组（`registerType` push）  
- `getType(name, obj)` 已按 `instanceof` 找实现  
- `getDefaultType` = 默认实现（3a 后：**可配置**，不再「永远是注册顺序第一个且不可改」）  
- `TASONTypeDiscriminator` 已存在——3b 对齐文档并补测  

---

## 3.2 行为

| 场景 | 行为 |
| --- | --- |
| parse 无 expected | 用 `getDefaultType`（**3a 后可被 Mongo 设为 Long**） |
| 仅 duck push、未改默认 | parse 仍官方 Int64；stringify(Long) → `Int64("…")` |
| `setDefaultType("Int64", longInfo)` 后 parse | 得到 Long；stringify 仍 `Int64("…")` |
| parseAs(User, text) | 解析后若为 object 类型，优先匹配 User 可赋值实现；数值鸭子按 ctor 选 |
| parseAs(Long, `Int64("1")`) | 单次得到 Long，**不**要求已设全局默认 |
| FakeLong 仅鸭子 | stringify → `Int64("…")`；parse 默认仍官方，除非默认已切或 parseAs |
| 多态子类 | 原型链 / discriminator；首版不要求接口注册表 |

---

## 3.3 与 schema 的关系

- Schema 描述 **RuntimeType**（`bigint` / `instance(Long)`），不描述「用哪个鸭子类」作全局默认  
- 全局默认实现影响 **无契约 parse 叶子** 与 TypeInstance 构造；有 schema 时仍按契约收 RuntimeType（阶段 2）  
- 若契约写 `instance(bson.Long)` 而默认仍是核心 Int64，会在映射层失败或需二次转换 → **Mongo + schema 场景更应开 3a 默认**  
- `parseAs` 可同时：按 Schema 收值 + 按 ctor 选实现  

---

## 3.4 任务清单

### 3a（Mongo / 扩展包前置）

| # | 任务 |
| --- | --- |
| 3a.1 | `setDefaultType` / `setDefaultTypeByCtor`（或 `registerType(..., { asDefault })`）实现与单测 |
| 3a.2 | 确认 Visitor / `createInstance(name)` / `createInstanceByCtor` 路径均走 `getDefaultType` |
| 3a.3 | `clone()` 保留默认实现顺序 |
| 3a.4 | 文档：默认实现 vs 鸭子 vs parseAs 对照表（本节 + monorepo plan 交叉链接） |
| 3a.5 | 示例：Int64 默认切到 FakeLong / 模拟 Long 后 round-trip 类型稳定 |

### 3b（完整鸭子 / 多态，可后置）

| # | 任务 |
| --- | --- |
| 3b.1 | `registerDuckType` 语义明确（alias of push + 文档；或校验 name 已存在） |
| 3b.2 | `parseAs` 实现：parse 管线 + expected 选型 |
| 3b.3 | Visitor/createInstance：支持指定 typeInfo 而非仅 default（parseAs 路径） |
| 3b.4 | 与 discriminator 行为对齐测试 |
| 3b.5 | 示例：默认官方 + 鸭子 + parseAs(FakeLong) |
| 3b.6 | 文档与 CHANGELOG |

---

## 3.5 测试矩阵

新开 `test/duck*.test.ts`（不混入阶段 1/2 套件）。可先只落地 3a 相关用例。

| 编号 | 场景 | 子阶段 |
| --- | --- | --- |
| D0 | `setDefaultType` 后 parse 得到新默认 ctor 实例 | **3a** |
| D0b | 未设默认时仅 duck：parse 仍 types 原默认 | **3a** |
| D0c | clone 后默认实现一致 | **3a** |
| D0d | 默认=Long 时 stringify/parse 多轮 RuntimeType 不变 | **3a** |
| D1 | registerDuckType 后 stringify 鸭子实例得到正确 TypeName | 3b/已有能力 |
| D2 | parse 默认在未 setDefault 时不破坏 builtin | 3a |
| D3 | parseAs(FakeLong, `Int64("1")`) 得到 FakeLong | 3b |
| D4 | parseAs(User) + schema 契约收值同时生效 | 3b |
| D5 | 子类 / discriminator 多态一轮 | 3b |

---

## 3.6 DoD

### 3a DoD（可单独勾选）

- [ ] 公开 API 可指定 TypeName 的默认 `TASONTypeInfo`  
- [ ] parse 无 expected 时使用该默认；builtin 默认行为无回归  
- [ ] clone 保持默认；测试 D0–D0d / D2  
- [ ] monorepo Mongo 可声明 `defaultImplementations`  

### 3b DoD

- [ ] `registerDuckType` + `parseAs` 公开可用  
- [ ] 与 schema 数值路径无冲突  
- [ ] 文档示例完整（含「全局默认 vs parseAs」）  

---

## 3.7 与 monorepo 的排期关系

```
Phase 2.2 (done) ──► 3a 默认实现 ──► tason-mongodb P0（ObjectId + Long/Decimal 作可选默认）
                         │
                         └──► 3b parseAs / 鸭子打磨（并行或后置，不挡 Mongo 首发）
```

**不需要**为了「默认用 Long」提前完成整个阶段 3；**需要**调整阶段 3 范围，把 **3a 提前**（相对原「整阶段一起做」）。

---

## 相关链接

- 上一阶段：[phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md)  
- 总进度：[implementation-plan.md](./implementation-plan.md)  
- Mongo / monorepo：[../monorepo/implementation-plan.md](../monorepo/implementation-plan.md)  
