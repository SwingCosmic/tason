import TASONTypeRegistry from "./TASONTypeRegistry";


export interface SerializerOptions {
  /** 是否允许使用不安全的类型，默认 false */
  allowUnsafeTypes?: boolean;
  /** 是否使用内置字典类型来序列化Map，默认 false（序列化为普通对象） */
  useBuiltinDictionary?: boolean;
  /** 反序列化对象时是否采用`Object.create(null)`，默认false */
  nullPrototypeObject?: boolean;
  /** 是否允许对象拥有重复的键，默认true */
  allowDuplicatedKeys?: boolean;
  /** 序列化时的缩进大小（单位为空格数），0表示不缩进，false表示压缩内容。默认false */
  indent?: number | false;
  /** 最大递归深度，默认64 */
  maxDepth?: number;
}

export interface SerializerOptionsInit extends SerializerOptions {
  registry?: TASONTypeRegistry;
}
