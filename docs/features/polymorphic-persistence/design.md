# 设计：TypeInstance 文档标记中间层

> 状态：**方向已锁定** · 实现未开工  
> 进度：[implementation-plan.md](./implementation-plan.md)

---

## 0. 锁定架构

```
┌──────────────────────────────────────────────────────────┐
│  应用内存：对象图（Dog / User / ObjectId / …）              │
└────────────────────────┬─────────────────────────────────┘
                         │
         ┌───────────────▼───────────────┐
         │  TASON 中间层（本 feature）      │
         │  toDocument  /  fromDocument    │
         │  · 每个 ObjectType 节点写标记字段 │
         │  · 按 Registry 还原 ctor        │
         │  · 递归嵌套 / 数组 / 动态键     │
         └───────────────┬───────────────┘
                         │ plain object 图
                         │ （叶子上可以带着 Date、已注册的 BSON 类）
         ┌───────────────▼───────────────┐
         │  文档库（例如 mongodb 驱动）     │
         │  insert / find                  │
         │  文档字段里可以有 _t             │
         └─────────────────────────────────┘
```

若应用同时注册了 BSON 标量（`tason-mongodb` 等），叶子上的 `ObjectId` / `Long` 会作为实例留在 plain 图里，中间层不给它们写 `_t`。那是组合用法，不是本 feature 的实现前置。

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| **TASON 中间层** | 所有 **ObjectType** 节点的标记写入与读回还原；开放嵌套图的遍历 | 连库、Mongoose 插件、BSON 编解码 |
| **`tason-mongodb`（另一 feature）** | Registry 上的 **BSON 标量** TypeInfo | **禁止** 对象多态、禁止递归打标、禁止 `toDocument` |
| **TASON 文本** `parse` / `stringify` | 文本协议 TypeName | 与中间层 **并行**；进文档库默认走中间层，而不是整段 stringify |
| **ODM（可选）** | 用户若另用 Mongoose 顶层 discriminator | 与中间层可并存，互不依赖 |

**和 C# 的类比：** 中间层 ≈ 驱动 ClassMap 管线里「给文档打 `_t` + 按 `_t` new 类型」。  
**差别：** Node 官方驱动没有这一层，所以放在 **TASON 仓库的中间层**（核心子模块或 `tason` 导出），而不是指望 `mongodb` 包。

---

## 1. 问题

- TASON 文本：`Dog({…})` 自描述。
- 写入 Mongo 的 plain / BSON：**没有** TypeInstance 语法 → 嵌套动态图里的 class 会变成纯对象。
- ODM discriminator 只擅长 **路径固定 + 类型封闭**；**开放嵌套动态** 不够用（见 §5）。

用户期望：像 `_t` 一样，在每个需要保留类型的 TypeInstance 上多写一个标记字段；BSON 扩展只管标量；**转回实例完全由 TASON 中间层做**。

---

## 2. 标记语义

### 2.1 字段名

| 项 | 决定 |
| --- | --- |
| **默认键** | `_t`（与 C# Mongo 驱动习惯对齐，跨语言文档更好认） |
| **可配置** | `discriminatorKey?: string`（例如 `__tason`、`__t`，以便兼容 Mongoose） |
| **冲突** | 业务字段不得占用该键；冲突时 `throw` 或走 `options.onKeyConflict` |

### 2.2 何时写标记

| 节点 | 是否写 `_t` |
| --- | --- |
| Registry 命中的 **ObjectType** 实例（`tryGetTypeInfo` → object kind） | **是**，值为 **TypeName**（如 `"Dog"`、`"User"`） |
| Registry 命中的 **ScalarType**（`ObjectId`、`Int64` / `Long`、`Date`…） | **否**（叶子由运行时类本身表达；中间层递归时原样保留，或按策略转换） |
| 未注册的 plain object | **否**（保持 plain；可选 `onUnknownObject: "throw" \| "plain"`） |
| 数组 | 对 **每个元素** 递归；数组自身不写 `_t` |
| `null` / 原始类型 | 不写 |

**默认策略：`tagMode: "registered-object"`**  
= 凡 `tryGetTypeInfo` 得到 **object** kind 就打标（含嵌套动态字段里的实体）。  
这就是「所有对象类 TypeInstance 都打标记」的可操作定义。

可选后续：

- `polymorphic-only`：仅实际名 ≠ expected 时打标（省字段，MVP 不做）
- 标量也包一层 `{ _t: "ObjectId", v: "…" }`（**明确不做**：和「BSON 包保留 BSON 类型」冲突，体积也更大）

### 2.3 写入形状示例

内存：

```js
{
  meta: { any: true },
  owner: new User({ id: 1n, name: "Ada" }),
  items: [new Dog({ name: "Fido" }), { raw: 1 }],
}
```

`toDocument` 后（示意）：

```js
{
  meta: { any: true },
  owner: {
    _t: "User",
    id: 1n,              // 或 number，随数值策略；Registry 里若有 Long 则可以是 Long
    name: "Ada",
  },
  items: [
    { _t: "Dog", name: "Fido" },
    { raw: 1 },
  ],
}
```

`fromDocument`：看到 `_t: "User"` → 去掉 `_t`，递归还原字段，再 `registry.createInstance("User", fields…)`。

### 2.4 与 TASON 文本的对应

| TASON 文本 | 文档标记形态 |
| --- | --- |
| `User({ id: …, name: … })` | `{ _t: "User", id: …, name: … }` |
| `Dog({ name: "Fido" })` | `{ _t: "Dog", name: "Fido" }` |
| `ObjectId("…")` | `ObjectId` 实例（或驱动可序列化的形态），**没有** `_t` |
| 对象字面量 `{ a: 1 }` | `{ a: 1 }`，没有 `_t` |

中间层 **不是** 把整棵树 `stringify` 成字符串再存，而是 **结构化文档 + 节点标记**。

---

## 3. 中间层 API（草案）

放在 **TASON 侧**（推荐核心导出或 `tason/document` 子路径），**peer 不依赖** `bson` / `mongodb`。

```ts
export type DocumentMapperOptions = {
  /** 默认 "_t" */
  discriminatorKey?: string;
  /** 默认 "registered-object" */
  tagMode?: "registered-object";
  /** 未注册 plain object：默认 "plain" */
  onUnknownObject?: "plain" | "throw";
  /** 字段名与标记键冲突：默认 "throw" */
  onKeyConflict?: "throw" | "rename-skip"; // MVP 可只 throw
};

/** 运行时图 → 可 insert 的 plain 图（叶子可含 Date / 已注册 BSON 类） */
export function toDocument(
  value: unknown,
  registry: TASONTypeRegistry,
  options?: DocumentMapperOptions,
): unknown;

/** find 得到的文档 → 运行时图（按 _t + Registry） */
export function fromDocument<T = unknown>(
  doc: unknown,
  registry: TASONTypeRegistry,
  options?: DocumentMapperOptions & {
    /** 根没有 _t 时的期望 TypeName 或 ctor */
    expected?: string | abstract new (...args: any[]) => any;
  },
): T;
```

命名统一为 `toDocument` / `fromDocument`，不再使用 dehydrate / hydrate 这一对说法。

**依赖 Registry（已有 API）：**

- 写出：`tryGetTypeInfo` → TypeName + kind
- 读入：`getDefaultType(name)` / 默认实现 + `createInstance`
- 字段：对 object 参数递归 `fromDocument`，再交给 object deserialize / ctor assign

**循环引用：** 检测后 `throw`（与 Generator 一致）。

---

## 4. 与 `tason-mongodb` 的职责边界

| | 中间层（本 feature） | `tason-mongodb` |
| --- | --- | --- |
| 输入 / 输出 | 任意 JS 值图 / plain 图 | TypeInfo 注册到 Registry |
| `_t` | **写入与解释** | 不碰 |
| ObjectId | 当作已注册 scalar：**原样保留实例** | 提供 TypeInfo，使 `instanceof ObjectId` 能 stringify 到 TASON 文本 |
| Long 作 Int64 默认 | 不实现 | 用核心 `asDefault`；选项名见 monorepo 计划 |
| `insertOne` | 不调用 | 不调用 |

**组合用法（用户代码，两边都齐了才能这样写）：**

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";
import { toDocument, fromDocument } from "tason"; // 或 tason/document

registerMongoDBTypes(TASON.registry, { replaceDefaultImplementation: { Int64: true } });

const plain = toDocument(domainGraph, TASON.registry);
await coll.insertOne(plain);

const raw = await coll.findOne({ _id });
const graph = fromDocument(raw, TASON.registry);
```

中间层 **不** import `tason-mongodb`。只要 Registry 里已经有 BSON 类型，叶子自然保留；没有也不影响 ObjectType 打标。

---

## 5. 为何仍要中间层

| | 顶层封闭继承 | 嵌套动态 + 开放实体 |
| --- | --- | --- |
| Mongoose discriminator | 够用 | Mixed / 未登记 → **丢掉 class** |
| C# `_t` + ClassMap | 驱动内建 | 开放图仍要登记类型；动态 BsonDocument 不会自动变成 POCO |
| **本中间层 + Registry** | 可用 | **主要场景**：每一层 ObjectType 自带 `_t` |

ODM 仍可作为 **另一条** 用户路径；本仓库的默认路径是：中间层打标 +（可选）mongodb 包标量。

---

## 6. 风险与规则

| 风险 | 处理 |
| --- | --- |
| `_t` 与业务字段冲突 | 默认 throw；文档禁止业务使用该键 |
| 与 Mongoose `__t` 同库混用 | 可配置 key；不自动双写 |
| 旧数据无标记 | `expected` 或当 plain；迁移脚本可选 |
| 只 `registerType`、未替换默认 | scalar 默认仍是 core；与 BSON 包是否替换默认无关 |
| 把中间层误放进 tason-mongodb | **评审拒绝**；职责表见 §0 |

---

## 7. 固定决策清单

1. **做** TASON 侧中间层：`toDocument` / `fromDocument`（名可微调）。
2. **默认标记键 `_t`**，可配置。
3. **所有已注册 ObjectType 节点** 写入时打标（嵌套、数组元素、动态字段内的实体一视同仁）。
4. **Scalar / BSON 叶子不打 `_t`**；靠类型实例本身保留。
5. **`tason-mongodb` 只做 BSON 标量注册**，禁止对象图逻辑。
6. **不**把整棵动态树默认存成 TASON 字符串（那是另一种可选模式，不是本主路径）。
7. **不**修改 `TASON.g4`；标记只存在于文档映射层。
8. 与 monorepo / BSON 包 **分开维护、分开实现**，互不等待对方阶段。

---

## 相关

- [implementation-plan.md](./implementation-plan.md)
- 已有 API：`tryGetTypeInfo`、`createInstance`、`getDefaultType`
