# tason-mongodb

MongoDB / BSON 类型扩展（`ObjectId`；`Long` 追加类型实现到 `Int64` 等）。

> **状态：注册骨架已就绪；TypeInfo 按 C1 / C2 / C3 填入。**  
> `registerMongoDBTypes` / `MongoTypes` / `replaceDefaultImplementation` 可用；
> 未填 TypeInfo 的项 register 时跳过。  
> 设计与排期见 [docs/features/monorepo/](../../docs/features/monorepo/)。  
> 类型清单与映射：[phase-c-bson-types.md](../../docs/features/monorepo/phase-c-bson-types.md)。

## 安装

```bash
npm install tason tason-mongodb bson
```

`bson` 为 **peerDependencies**，请与项目中 `mongodb` / `mongoose` 解析到的 `bson` 版本对齐，避免双份副本导致 `instanceof` 失败。

## 用法

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
// 仅追加类型实现（parse 仍用核心默认；stringify 认 BSON 实例）：
registerMongoDBTypes(s.registry);
// 将 Long / Decimal128 等设为默认实现：
// registerMongoDBTypes(s.registry, { replaceDefaultImplementation: true });
// 或：{ replaceDefaultImplementation: { Int64: true } }
// 选择性注册：{ include: ["ObjectId", "Int64"] }
```

| 选项 | 行为 |
| --- | --- |
| （缺省） | 对 `Int64` / `Decimal128` 等只 **追加类型实现**：`parse` 仍为核心包装；`stringify(new Long(…))` 可写出 `Int64("…")` |
| `replaceDefaultImplementation: true` | 上述可映射项全部改为默认实现，`parse('Int64("1")')` 得到 `bson.Long` |
| `replaceDefaultImplementation: { Int64: true }` | 按 TypeName 细开 |
| `include` | 只注册列出的 TypeName；未知名抛错 |

C1 完成前：`ObjectId("…")` 仍会因未注册而失败；`Int64` 在 C2 之前仍走核心实现。

## 公开导出

| 导出 | 说明 |
| --- | --- |
| `registerMongoDBTypes(registry, options?)` | 注册入口（返回同一 registry） |
| `MongoTypes` | TypeInfo 表；阶段 C 填入，也可测试覆盖 |
| `MongoTypeCatalog` | TypeName / 新类型 vs 追加 / 可否替换默认 |
| `RegisterMongoDBTypesOptions` | 选项类型 |

## 范围边界

- **本包：** TASON TypeName ↔ BSON 标量值（`ObjectId`、`Long`、`Decimal128` …）
- **不在本包：** 对象图 `_t` 打标 / `toDocument` / `fromDocument`（见 [`docs/features/polymorphic-persistence/`](../../docs/features/polymorphic-persistence/)）

组合（中间层实现后）：先 `registerMongoDBTypes`，再对对象图调用 `toDocument` / `fromDocument`。两包只通过 **共享 Registry** 组合，本包不 import 中间层。

## License

MIT
