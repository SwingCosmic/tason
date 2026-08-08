# 阶段 3：鸭子类型与多态反序列化

> **状态：待办**  
> 进度入口：[implementation-plan.md](./implementation-plan.md) · 设计：[runtime-type-design.md](./runtime-type-design.md)  
> 用语：[README 概念对照](./README.md#概念对照读本文档前)  
> 依赖：[阶段 2](./phase-2-class-metadata-schema.md)（建议 2.2 完成后；`parseAs` 可与 2.2 末期并行，但 D4 依赖 schema）

---

## 3.0 目标

同名多实现注册、序列化选型、反序列化在期望类型下选型；与阶段 2 的 schema 层**正交**。

对照 C# Registry 多实现列表；JS 补齐 `registerDuckType` / `parseAs` 与文档对齐。

---

## 3.1 API

```ts
// 追加实现；不替换 types[0]
registerDuckType(name: string, typeInfo: TASONTypeInfo<T>): void

// 期望类型引导：ctor | 已注册类型名 | 其它描述（实现时定）
parseAs<T>(expected: Constructor<T> | string, text: string): T
```

既有能力复用：

- `types: TASONTypeInfo[]` 已是数组（`registerType` push）  
- `getType(name, obj)` 已按 `instanceof` 找实现  
- `getDefaultType` = `types[0]`  
- `TASONTypeDiscriminator` 已存在——本阶段对齐文档并补测  

---

## 3.2 行为

| 场景 | 行为 |
| --- | --- |
| parse 无 expected | 用 `getDefaultType`（types[0]） |
| parseAs(User, text) | 解析后若为 object 类型，优先匹配 User 可赋值实现；数值鸭子按 ctor 选 |
| stringify 鸭子实例 | `tryGetTypeInfo` 已能 `instanceof` 命中后注册的实现 |
| FakeLong 注册为 Int64 鸭子 | stringify → `Int64("…")`；parse 默认仍官方 Int64，除非 parseAs(FakeLong) |
| 多态子类 | 原型链 / discriminator；首版不要求接口注册表 |

---

## 3.3 与 schema 的关系

- Schema 描述 **RuntimeType**（bigint），不描述「用哪个鸭子类」  
- 鸭子：同一 **TypeName** 对应多个 RuntimeType / JS 实现（与「一个 RuntimeType 多种 TypeInstance」对称，见 [README](./README.md#概念对照读本文档前)）  
- `parseAs` 可同时：按 Schema 收值 + 按 ctor 选实现  

---

## 3.4 任务清单

| # | 任务 |
| --- | --- |
| 3.1 | `registerDuckType` 语义明确（alias of push + 文档；或校验 name 已存在） |
| 3.2 | `parseAs` 实现：parse 管线 + expected 选型 |
| 3.3 | Visitor/createInstance：支持指定 typeInfo 而非仅 default |
| 3.4 | 与 discriminator 行为对齐测试 |
| 3.5 | 示例：Int64 默认 + FakeLong 鸭子 |
| 3.6 | 文档与 CHANGELOG |

---

## 3.5 测试矩阵

新开 `test/duck*.test.ts`（不混入阶段 1/2 套件）。

| 编号 | 场景 |
| --- | --- |
| D1 | registerDuckType 后 stringify 鸭子实例得到正确 TypeName |
| D2 | parse 默认仍 types[0] |
| D3 | parseAs(FakeLong, `Int64("1")`) 得到 FakeLong |
| D4 | parseAs(User) + schema 契约收值同时生效 |
| D5 | 子类 / discriminator 多态一轮 |

---

## 3.6 DoD

- [ ] `registerDuckType` + `parseAs` 公开可用  
- [ ] 默认 parse 不破坏既有默认实现  
- [ ] 与 schema 数值路径无冲突  
- [ ] 文档示例完整  

---

## 相关链接

- 上一阶段：[phase-2-class-metadata-schema.md](./phase-2-class-metadata-schema.md)  
- 总进度：[implementation-plan.md](./implementation-plan.md)  
