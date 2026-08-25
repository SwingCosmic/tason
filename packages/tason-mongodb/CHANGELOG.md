# Changelog

本文件只记录面向库用户的功能性变更、bug 修复与重大内部重构；项目结构调整、文档优化、构建流程与测试调整不在此记录。

每个 minor 小节收录**上一个 minor 最新版本**到**该 minor 最新版本**之间的修改内容，以实际发布到 npm 的版本为准。

## 0.3 — 0.3.2 (2026-08-25)

自 0.2.3-beta2 以来的修改：

- **修复**：`bson` 与 `mongodb` 包的 cjs / esm 版本被同时加载时产生双实例、导致 `instanceof` 判断失效的问题。包内统一经由 `bson-ns` 命名空间解析 BSON 类，并补充 `exports` 字段明确入口。
- **文档**：新增本 CHANGELOG（0.3.2，无功能性变更）。

详见 [MongoDB 扩展文档](../../docs/tason-mongodb.md)。

## 0.2 — 0.2.3-beta2 (2026-08-16)

首个发布版本（0.2.3-beta1 / 0.2.3-beta2）：

- **注册入口**：提供 `registerMongoDBTypes` 与序列化选项定义，将 MongoDB / BSON 标量类型接入 TASON 类型体系；BSON 类型不进入核心包默认表，需显式注册。
- **BSON 类型全面接入**：注册 `ObjectId`、`Decimal128`、`Long`、`Binary`（含 MD5 / Encrypted / Sensitive / Vector 等 subtype）、`Timestamp`、`MinKey` / `MaxKey`、`BSONJavaScript` 等类型的 TypeInfo，支持与 TASON 文本及 BSON 的双向转换。
- **默认实现替换**：提供 `replaceDefault` 系 TypeInfo，可将 `bson.Long` / `bson.Decimal128` / `bson.Int32` / `bson.Double` / UUID 的 Binary 形式等设为对应核心 TypeName（如 `Int64`）的默认实现，配合核心包的 `asDefault` / `setDefaultType` 机制使用。
- peer 依赖 `tason ^1.2.1-beta1`、`bson ^6.0.0`。

详见 [MongoDB 扩展文档](../../docs/tason-mongodb.md) · [类型系统](../../docs/type-system.md)。
