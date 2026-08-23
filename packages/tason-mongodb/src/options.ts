import type { BsonNamespace } from "./bson-ns";
import type { MongoTypeName } from "./types";

/**
 * 将 bson.Long / Decimal128 等设为对应内置 TypeName 的默认实现。
 * 仅对 {@link MongoTypeSpec.canReplaceDefault} 的 append 项生效。
 */
export type ReplaceDefaultImplementationMap = {
  Int64?: boolean;
  Decimal128?: boolean;
  UUID?: boolean;
  Buffer?: boolean;
  Int32?: boolean;
  Float64?: boolean;
};

export type RegisterMongoDBTypesOptions = {
  /**
   * 绑定 TypeInfo.ctor / deserialize 的 bson 命名空间。
   * 写入模块持有点；静态 TypeInfo 的 `ctor` 经 getter 读到同一份 class。
   * 省略则 {@link loadDefaultBson}（Node CJS `bson`，与 `mongodb` / `mongoose.mongo` 同一副本）。
   *
   * 典型：`mongoose.mongo`、`import { … } from 'mongodb'`。不要 `import from 'bson'`（ESM 会是另一份）。
   */
  bson?: BsonNamespace;
  /**
   * 是否将可映射项设为对应内置 TypeName 的默认实现
   *（内部调用核心 `registerType(..., { asDefault })`）。
   * - 缺省 / false：仅追加类型实现（parse 仍用核心默认；stringify 可识别实例）
   * - true：对可映射项全部替换默认
   * - 对象：按 TypeName 细开
   */
  replaceDefaultImplementation?: boolean | ReplaceDefaultImplementationMap;
  /** 选择性注册；默认全部 */
  include?: MongoTypeName[];
};
