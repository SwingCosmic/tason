# Changelog

本文件只记录面向库用户的功能性变更、bug 修复与重大内部重构；项目结构调整、文档优化、构建流程与测试调整不在此记录。

每个 minor 小节收录**上一个 minor 最新版本**到**该 minor 最新版本**之间的修改内容，以实际发布到 npm 的版本为准。

## 1.2 — 1.2.2 (2026-08-25)

自 1.1.4-beta2 以来的修改：

- **多实现支持（阶段 3）**：同一 TypeName 可注册多个类型实现，通过 `registerType(name, typeInfo, metadata?, { asDefault })` 追加实现或指定默认；新增 `setDefaultType` / `setDefaultTypeByCtor` 设置默认实现，`getTypeInfoByCtor` / `parseAs` 按期望构造函数或 TypeName 进行解析。
- **`RegisterTypeOptions.match`**：同一 ctor 对应多个 TypeName 时（如 `bson.Binary` 的不同 subtype），可用自定义谓词再过滤一次，缺省仍按 `instanceof` 匹配。
- **顶层导出补全**：显式导出 `TASONSerializer`、`TASONTypeRegistry` 与 `RegisterTypeOptions` 类型。
- **修复**：`ArrayBuffer` / `TypedArray` 等内存数组被错误当作可迭代对象逐元素序列化的问题。
- **文档**：新增本 CHANGELOG（1.2.2，无功能性变更）。

详见 [类型系统](../../docs/type-system.md)。

## 1.1 — 1.1.4-beta2 (2026-08-08)

自 1.0.3-beta1 以来的修改：

- **Class 元数据与 schema 契约（阶段 2.1）**：`registerType` 支持传入 `TasonClassMetadata`，新增 `getClassMetadata`；引入 `RuntimeSchemaAdapter` 抽象与 Valibot 实现 `createValibotAdapter()`（默认不启用，需 `setSchemaAdapter` 显式注册），实现 RuntimeType ↔ TypeInstance / 字面量的双向映射。
- **结构递归与 Handling 上下文（阶段 2.2）**：反序列化数值处理完成，序列化 / 反序列化 Number Handling 拆分为双选项 `serialize-number-handling` / `deserialize-number-handling`，并引入 ObjectType 内的 fallback 行为（`object-type-property` / `object-fallback-native` / `object-fallback-all`）。
- **修复**：`Symbol` 类型的注册与序列化 / 反序列化问题。

详见 [数值处理](../../docs/number-handling.md) · [实体元数据与 Schema](../../docs/class-metadata.md)。

## 1.0 — 1.0.3-beta1 (2026-08-08)

自 0.x 以来的修改：

- **首个 1.x 版本**：提供 JSON5 风格文本的解析与序列化、自描述 TypeName（如 `Int64("1")`、`User({…})`）、内置类型集（数值、日期、UUID、Buffer、RegExp、Dictionary 等）以及基于装饰器的类型元数据指定。
- **`nullPropertyHandling` 序列化选项**：支持 `"preserve"` / `"ignore"`，控制遇到 `null` 属性时的写出行为。
- **修复（1.0.1）**：隐式依赖与可能不存在的内置类型导致的加载失败。
- **修复（1.0.2）**：字符串中嵌套引号的解析问题。
- **数值序列化控制（1.0.3-beta1）**：新增 `serialize-number-handling` 选项（`unsafe-only` / `all` / `object-type-property` / `none`），控制数值在序列化时是否装箱为带类型的对象。
