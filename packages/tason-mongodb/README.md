# tason-mongodb

MongoDB / BSON 类型扩展（`ObjectId`；`Long` 追加类型实现到 `Int64` 等）。

> **状态：脚手架** — 依赖与包结构已就绪，**尚未实现**类型注册与 ser/de。  
> 设计与排期见仓库根目录 [docs/features/monorepo/](../../docs/features/monorepo/)。

## 安装（计划）

```bash
npm install tason tason-mongodb bson
```

`bson` 为 **peerDependencies**，请与项目中 `mongodb` / `mongoose` 解析到的 `bson` 版本对齐，避免双份副本导致 `instanceof` 失败。

## 用法（计划 API，未实现）

```ts
import TASON from "tason";
import { registerMongoDBTypes } from "tason-mongodb";

const s = new TASON.Serializer();
// 仅追加类型实现（parse 仍用核心默认；支持鸭子类型注册）：
registerMongoDBTypes(s.registry);
// 将 Long/Decimal128 等设为默认实现：
// registerMongoDBTypes(s.registry, { replaceDefaultImplementation: true });
// 或：{ replaceDefaultImplementation: { Int64: true } }
```

## 范围边界

- **本包：** TASON TypeName ↔ BSON 标量值（`ObjectId`、`Long`、`Decimal128` …）
- **不在本包：** 对象图 `_t` 打标 / `toDocument` / `fromDocument`（见 `docs/features/polymorphic-persistence/`）

## License

MIT
