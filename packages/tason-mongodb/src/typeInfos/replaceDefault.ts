import { defineType } from "tason";
import {
  Binary,
  Decimal128,
  Double,
  Int32,
  Long,
  UUID,
} from "bson";

/** Long 继承链含 Timestamp，必须靠 _bsontype 拆开 */
export const Int64TypeInfo = defineType<Long>({
  kind: "scalar",
  ctor: Long,
  match: (value) => value._bsontype === "Long",
  serialize: (value) => value.toString(),
  deserialize: (value) => Long.fromString(value),
});

export const Decimal128TypeInfo = defineType<Decimal128>({
  kind: "scalar",
  ctor: Decimal128,
  serialize: (value) => value.toString(),
  // 不 rounding，与分册表 3 一致
  deserialize: (value) => Decimal128.fromString(value),
});

export const Int32TypeInfo = defineType<Int32>({
  kind: "scalar",
  ctor: Int32,
  serialize: (value) => value.toString(),
  deserialize: (value) => Int32.fromString(value),
});

export const Float64TypeInfo = defineType<Double>({
  kind: "scalar",
  ctor: Double,
  serialize: (value) => value.toString(),
  deserialize: (value) => Double.fromString(value),
});

export const UUIDTypeInfo = defineType<UUID>({
  kind: "scalar",
  ctor: UUID,
  serialize: (value) => value.toHexString(),
  deserialize: (value) => new UUID(value),
});

/**
 * Binary subtype 3/4 与 UUID 共用基类；ctor 用 Binary 才能 instanceof 命中。
 * parse 默认仍走 {@link UUIDTypeInfo}（或核心 UUID）。
 */
export const UUIDBinaryTypeInfo = defineType<Binary>({
  kind: "scalar",
  ctor: Binary,
  match: (value) =>
    !(value instanceof UUID) &&
    (value.sub_type === Binary.SUBTYPE_UUID_OLD ||
      value.sub_type === Binary.SUBTYPE_UUID),
  serialize: (value) =>
    new UUID(value.buffer.subarray(0, 16)).toHexString(),
  deserialize: (value) => new UUID(value),
});
