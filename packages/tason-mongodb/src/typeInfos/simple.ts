import { defineType } from "tason";
import { Code, MaxKey, MinKey, ObjectId, Timestamp } from "bson";

const OBJECT_ID_HEX = /^[0-9a-fA-F]{24}$/;

export const ObjectIdTypeInfo = defineType<ObjectId>({
  kind: "scalar",
  ctor: ObjectId,
  serialize: (value) => value.toHexString(),
  deserialize: (value) => {
    if (!OBJECT_ID_HEX.test(value)) {
      throw new TypeError(`Invalid ObjectId: ${value}`);
    }
    return new ObjectId(value);
  },
});

export const BSONMinKeyTypeInfo = defineType<MinKey>({
  kind: "scalar",
  ctor: MinKey,
  serialize: () => "",
  deserialize: (value) => {
    if (value !== "") {
      throw new TypeError("BSONMinKey does not take a payload");
    }
    return new MinKey();
  },
});

export const BSONMaxKeyTypeInfo = defineType<MaxKey>({
  kind: "scalar",
  ctor: MaxKey,
  serialize: () => "",
  deserialize: (value) => {
    if (value !== "") {
      throw new TypeError("BSONMaxKey does not take a payload");
    }
    return new MaxKey();
  },
});

export const BSONTimestampTypeInfo = defineType<Timestamp>({
  kind: "object",
  ctor: Timestamp,
  match: (value) => value._bsontype === "Timestamp",
  serialize: (value) => ({ t: value.t, i: value.i }),
  deserialize: (value) => {
    const t = (value as { t?: unknown }).t;
    const i = (value as { i?: unknown }).i;
    if (typeof t !== "number" || typeof i !== "number") {
      throw new TypeError("BSONTimestamp requires numeric t and i");
    }
    return new Timestamp({ t, i });
  },
});

export const BSONJavaScriptTypeInfo = defineType<Code>({
  kind: "scalar",
  ctor: Code,
  serialize: (value) => {
    if (value.scope != null) {
      throw new TypeError("BSONJavaScript does not support code with scope");
    }
    return value.code;
  },
  deserialize: (value) => new Code(value),
});
