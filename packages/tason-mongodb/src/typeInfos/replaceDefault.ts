import { defineType } from "tason";
import type { Binary, Decimal128, Double, Int32, Long, UUID } from "bson";
import { getBson } from "../bson-ns";

/** Long 继承链含 Timestamp，必须靠 _bsontype 拆开 */
export const Int64TypeInfo = defineType<Long>({
  kind: "scalar",
  get ctor() {
    return getBson().Long;
  },
  match: (value) => value._bsontype === "Long",
  serialize: (value) => value.toString(),
  deserialize: (value) => getBson().Long.fromString(value),
});

export const Decimal128TypeInfo = defineType<Decimal128>({
  kind: "scalar",
  get ctor() {
    return getBson().Decimal128;
  },
  serialize: (value) => value.toString(),
  deserialize: (value) => getBson().Decimal128.fromString(value),
});

export const Int32TypeInfo = defineType<Int32>({
  kind: "scalar",
  get ctor() {
    return getBson().Int32;
  },
  serialize: (value) => value.toString(),
  deserialize: (value) => getBson().Int32.fromString(value),
});

export const Float64TypeInfo = defineType<Double>({
  kind: "scalar",
  get ctor() {
    return getBson().Double;
  },
  serialize: (value) => value.toString(),
  deserialize: (value) => getBson().Double.fromString(value),
});

export const UUIDTypeInfo = defineType<UUID>({
  kind: "scalar",
  get ctor() {
    return getBson().UUID;
  },
  serialize: (value) => value.toHexString(),
  deserialize: (value) => new (getBson().UUID)(value),
});

/**
 * Binary subtype 3/4 与 UUID 共用基类；ctor 用 Binary 才能 instanceof 命中。
 * parse 默认仍走 {@link UUIDTypeInfo}（或核心 UUID）。
 */
export const UUIDBinaryTypeInfo = defineType<Binary>({
  kind: "scalar",
  get ctor() {
    return getBson().Binary;
  },
  match: (value) => {
    const { Binary, UUID } = getBson();
    return (
      !(value instanceof UUID) &&
      (value.sub_type === Binary.SUBTYPE_UUID_OLD ||
        value.sub_type === Binary.SUBTYPE_UUID)
    );
  },
  serialize: (value) =>
    new (getBson().UUID)(value.buffer.subarray(0, 16)).toHexString(),
  deserialize: (value) => new (getBson().UUID)(value),
});
