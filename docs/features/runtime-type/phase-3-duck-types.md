# 阶段 3：鸭子类型、默认实现与指定类型反序列化

> **状态：已完成**  
> 进度入口：[implementation-plan.md](./implementation-plan.md) · 设计：[runtime-type-design.md](./runtime-type-design.md)  
> 用语：[术语与用语](../glossary.md)（含鸭子类型 / 代码标识符）  
> 本阶段在阶段 2.2 之上实现。扩展包如何调用这些 API，不在本分册跟踪进度。

---

## 3.0 目标

同一 TypeName 下**支持鸭子类型注册**（多种 JS 实现）、**可改默认实现**、序列化按实例选型、反序列化按期望类型选型；与阶段 2 schema 互不干涉。

改动集中在 Registry + Serializer / Visitor。扩展包（例如日后的 BSON 类型）只是这些 API 的调用方。

---

## 3.0.1 C# 对照（事实，非目标 API 照搬）

参考：`TasonTypeRegistry.cs`、`TasonSerializer.cs`、`TasonVisitor_Typed.cs`；C# 内置另有「次要实现」表在默认 Types 之后再 `RegisterType`（对方属性名可含 Duck，**不**迁入 JS 标识符）。

| 能力 | C# 现状 | JS 现状 | 本阶段动作 |
| --- | --- | --- | --- |
| 多实现列表 | `RegisterType` **总是 Add（push）** | 同：`types[]` + push | 保持 |
| 默认实现 | `GetDefaultType` = **列表第一项**；**无** `SetDefaultType` | 同：`types[0]`，不可改 | **补** `asDefault` / `setDefaultType` |
| 次要实现后注册 | 默认 Types 之后再 Register | 扩展在后面再 `registerType` | 文档约定 |
| 扩展包 | STJ 等对同名再 push，**不**抢默认 | 做成同样结构 | 仅「追加类型实现」时与 C# 相同 |
| 序列化选型 | `TryGetTypeInfo` / `GetType(name, obj)` | `tryGetTypeInfo` / `getType`：`instanceof` | 保持；补测 |
| 自动类型反序列化 | `Deserialize(text)` → `GetDefaultType` | `parse` → `getDefaultType` | 保持 |
| **指定类型**反序列化 | `Deserialize<T>`：TypeInstance 走 `GetType(name, implType)` | **无** | **`parseAs`**（子集） |
| 按 Type 取实现 | `GetType(name, Type)` | 仅 `getType(name, obj)` | 补 `getTypeInfoByCtor` |

**关键推论：**

1. C# 默认永远是 **先注册** 的实现；无「提升为默认」API。  
2. JS 核心先注册 builtin，扩展后 push **改不了** parse 默认 → 必须有 `asDefault` / `setDefaultType`（相对 C# 的有意增强）。  
3. C# 指定类型模式靠 `Deserialize<T>`；JS 用 `parseAs` 对齐有限子集（**多实现解析**时按期望 ctor 选型）。  
4. `parseAs` **不**迁移 C# 那一套集合 / 接口类型。

---

## 3.0.2 扩展包如何调用（本阶段只提供 API）

| 注册意图 | 核心调用 | parse `Int64("1")` | stringify(Long) |
| --- | --- | --- | --- |
| 追加类型实现（不改默认） | `registerType("Int64", longInfo)` | 核心包装 | `Int64("…")` |
| 替换默认实现 | `registerType(..., { asDefault: true })` 或 `setDefaultType` | 新的默认 ctor | 同左 |
| 新 TypeName | `registerType("ObjectId", oidInfo)` | `ObjectId` | `ObjectId("…")` |

扩展包内部只调上述核心 API，不要 fork Registry。  
具体选项名（例如 `replaceDefaultImplementation`）和类型矩阵写在对应扩展包的计划里，本分册不维护。

---

## 3.0a 问题：多轮 RuntimeType 抖动

| 方向 | 行为 |
| --- | --- |
| **stringify** | `instanceof` 命中已注册实现 → 写出对应 TypeName |
| **parse** | `getDefaultType` = `types[0]`（核心官方包装） |

仅 **追加类型实现**、未改默认时：parse 得核心包装 → 业务要 BSON 类再转换 → 抖动。

| 能力 | 作用域 | 典型用途 |
| --- | --- | --- |
| **`asDefault` / `setDefaultType`** | Registry 生命周期 | Mongo 优先：全程 Long |
| **`parseAs(ctor)`** | 单次调用 | 测试 / 偶发选型 / **多实现解析** |
| **仅追加类型实现** | stringify 认实例；parse 仍旧默认 | 文本侧仍用官方包装 |

---

## 3.1 锁定 API 形状

### 原则

- **支持鸭子类型注册** = 对已有 TypeName 再 `registerType`（push），**不为**此另发明公开方法名。  
- **默认 = `types[0]`**；`setDefaultType` / `asDefault` 用 **重排** 实现。  
- 签名兼容：`registerType(name, typeInfo, metadata?)` 仍合法。

### Registry

```ts
type RegisterTypeOptions = {
  /** true：该实现成为 getDefaultType；false/缺省：push（追加类型实现），不改当前默认 */
  asDefault?: boolean;
};

registerType<T>(
  name: string,
  typeInfo: TASONTypeInfo<T>,
  metadata?: TasonClassMetadata,
  options?: RegisterTypeOptions,
): void;

/** 已注册则提升为默认；未注册则先注册再置顶 */
setDefaultType<T>(name: string, typeInfo: TASONTypeInfo<T>): void;

/** 按 ctor 在该 TypeName 下查找并 setDefault；找不到抛错 */
setDefaultTypeByCtor(
  name: string,
  ctor: abstract new (...args: any[]) => any,
): void;

getDefaultType<T>(name: string): TASONTypeInfo<T> | undefined;
getType<T>(name: string, obj: T): TASONTypeInfo<T> | undefined;

/** 按期望构造函数选实现（对齐 C# GetType(name, Type)；多实现解析用） */
getTypeInfoByCtor<T>(
  name: string,
  ctor: abstract new (...args: any[]) => any,
): TASONTypeInfo<T> | undefined;
```

### Serializer

```ts
parse<T = any>(text: string): T;

/**
 * 指定类型反序列化（对齐 C# Deserialize&lt;T&gt; 子集；多实现解析）。
 * expected: 构造函数，或已注册 TypeName 字符串。
 */
parseAs<T>(
  expected: (abstract new (...args: any[]) => T) | string,
  text: string,
): T;
```

### 固定决策

1. 默认实现 = **`types[0]`**；通过重排维护。  
2. `getDefaultType` 是自动 `parse` 路径唯一来源。  
3. `clone()` 拷贝各 entry 的 `types` 顺序。  
4. `setDefaultType`：不在列表则先注册再置顶；`setDefaultTypeByCtor` 必须已存在。  
5. 公开 API：`registerType` + `setDefaultType*` + `getTypeInfoByCtor` + `parseAs`；**不为「追加类型实现」另设公开方法**。  
6. `parseAs` 首版：TypeInstance 选型 + schema 共存；不做 C# 那一套集合 / 接口类型。
7. 扩展包若要换默认实现，内部调用 `asDefault`。

---

## 3.2 行为矩阵

| 场景 | 行为 |
| --- | --- |
| parse 无 expected | `getDefaultType` |
| 仅追加类型实现、未改默认 | parse 仍官方；stringify(Long) → `Int64("…")` |
| `asDefault` / `setDefaultType` 后 parse | 新默认 ctor；TypeName 文本不变 |
| `parseAs(Long, \`Int64("1")\`)` | 单次 Long；全局默认不变 |
| `parseAs(User, text)` | ObjectType 选型 + 可选 schema |
| discriminator | 既有路径补测 |

---

## 3.3 与 schema

- Schema 描述 RuntimeType，不描述全局默认实现类。  
- 无契约叶子：受默认实现影响。  
- 有契约：仍按阶段 2；若契约是 `instance(Long)` 一类，调用方应先把默认实现换成对应 ctor。
- `parseAs`：先按期望 ctor 选 TypeInfo，再应用 schema（顺序见 D4）。

---

## 3.4 实现位置

| 项 | 路径 |
| --- | --- |
| Registry API | `packages/tason/src/TASONTypeRegistry.ts` |
| `parseAs` | `TASONSerializer.ts` + Visitor 带 expected 入口 |
| 导出 | `packages/tason/src/index.ts` |
| 测试 | `packages/tason/test/multi-implementation.test.ts` |

Visitor：自动路径不变；`parseAs` 传入 expected，TypeInstance 用 `getTypeInfoByCtor`，无匹配则 **抛**。

---

## 3.5 任务清单

| # | 任务 |
| --- | --- |
| 3.1 | `asDefault` / `setDefaultType` / `setDefaultTypeByCtor` |
| 3.2 | `getTypeInfoByCtor`；Visitor / `createInstance(string)` 走 `getDefaultType` |
| 3.3 | `clone()` 顺序 |
| 3.4 | `parseAs` |
| 3.5 | 测试 D0–D7；内置类型的基本回归 |
| 3.6 | 导出；DoD 勾选 |
| 3.7 | 面向用户的短链（type-system / README，可极短） |

---

## 3.6 测试矩阵

文件：`test/multi-implementation.test.ts`。

| 编号 | 场景 |
| --- | --- |
| D0 | `setDefaultType` / `asDefault` 后 parse 得新默认 |
| D0b | 仅追加类型实现：parse 仍原默认 |
| D0c | clone 后默认一致 |
| D0d | 默认切换后多轮序列化/反序列化类型稳定 |
| D1 | 追加类型实现后 stringify 实例 → 正确 TypeName |
| D2 | 未改默认时 builtin 无回归 |
| D3 | `parseAs(FakeLong, …)`；全局默认未变 |
| D4 | `parseAs(User)` + schema |
| D5 | discriminator / 子类一轮 |
| D6 | `getTypeInfoByCtor`；无匹配 parseAs 抛错 |
| D7 | `setDefaultType` 未注册 typeInfo → 先注册再置顶 |

---

## 3.7 DoD

- [x] `asDefault` / `setDefaultType*` 可用  
- [x] `parseAs` + `getTypeInfoByCtor` 可用；自动 parse 无回归  
- [x] clone；D0–D7  
- [x] 扩展包可以只靠这些 API 做「追加实现 / 替换默认」，不必改 Registry

---

## 3.8 排期

```
Phase 2.2 (done) ──► Phase 3（done）
```

---

## 相关链接

- [phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md)
- [implementation-plan.md](./implementation-plan.md)

