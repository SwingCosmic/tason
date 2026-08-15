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
