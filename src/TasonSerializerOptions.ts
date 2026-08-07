import TASONTypeRegistry from "./TASONTypeRegistry";

/**
 * 序列化数值处理策略
 * - unsafe-only（默认）：仅当数值超出安全范围时才装箱
 * - all：可识别数值实现尽量装箱
 * - object-type-property：对于ObjectTypeInstance相当于all；其它相当于unsafe-only
 * - none：强制所有数值为裸字面量（含超大 BigInt / 超精度 Decimal128，不写 TypeName）
 */
export type SerializeNumberHandling =
  | "unsafe-only"
  | "all"
  | "object-type-property"
  | "none";

/**
 * 反序列化数值处理策略
 * - native：全拆箱，使用原生number/bigint，以及对`Decimal128`使用Decimal
 * - all：保留包装类（旧版默认逻辑）
 * - record-type（默认）：尽可能尝试记录数值类型（主要针对数组和ObjectTypeInstance），以便于序列化的时候转回去，然后执行native
 * - object-type-property：对于ObjectTypeInstance相当于all；其它相当于native
 */
export type DeserializeNumberHandling =
  | "native"
  | "all"
  | "record-type"
  | "object-type-property";

export interface TASONSerializerOptions {
  /** 是否允许使用不安全的类型，默认 false */
  allowUnsafeTypes?: boolean;
  /** 是否使用内置字典类型来序列化Map，默认 false（序列化为普通对象） */
  useBuiltinDictionary?: boolean;
  /** 反序列化对象时是否采用`Object.create(null)`，默认false */
  nullPrototypeObject?: boolean;
  /** 是否允许对象拥有重复的键，默认true */
  allowDuplicatedKeys?: boolean;
  /** 遇到null时的序列化方式 */
  nullPropertyHandling?: NullValueHandling;
  /** 序列化时的缩进大小（单位为空格数），0表示不缩进，false表示压缩内容。默认false */
  indent?: number | false;
  /** 最大递归深度，默认64 */
  maxDepth?: number;
  /**
   * 序列化数值处理，默认 `"unsafe-only"`。
   * @see SerializeNumberHandling
   */
  serializeNumberHandling?: SerializeNumberHandling;
  /**
   * 反序列化数值处理，默认 `"record-type"`。
   * @see DeserializeNumberHandling
   */
  deserializeNumberHandling?: DeserializeNumberHandling;
}

export interface TASONSerializerOptionsInit extends TASONSerializerOptions {
  registry?: TASONTypeRegistry;
}


export type NullValueHandling = "preserve" | "ignore";
