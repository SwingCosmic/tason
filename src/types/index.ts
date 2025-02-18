import { defineType } from "./TASONTypeInfo";


export const unsafeTypes = ["Symbol"];

export const ScalarTypes = {
  Date: defineType({
    kind: "scalar",
    ctor: Date,
    serialize: (value) => value.toISOString(),
    deserialize: (value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new TypeError(`Invalid Date: ${value}`);
      }
      return date;
    },
  }),
  BigInt: defineType<bigint>({
    kind: "scalar",
    ctor: BigInt as any,
    serialize: (value) => value.toString(),
    deserialize: (value) => BigInt(value),
  }),
  RegExp: defineType({
    kind: "scalar",
    ctor: RegExp,
    serialize: (value) => value.toString(),
    deserialize: (value) => {
      const match = value.match(/^\/(.*)\/([gimsuy]*)$/);
      if (match) {
        return new RegExp(match[1], match[2]);
      } else {
        throw new TypeError(`Invalid RegExp: ${value}`);
      }
    },
  }),
  Symbol: defineType<symbol>({
    kind: "scalar",
    ctor: Symbol as any,
    serialize: (value) => value.toString(),
    deserialize: (value) => {
      const match = value.match(/^Symbol\((.*)\)$/);
      if (match) {
        return Symbol.for(match[1]);
      } else {
        throw new TypeError(`Invalid Symbol: ${value}`);
      }
    }
  })
};

export const ObjectTypes = {};

export const Types = {
  ...ScalarTypes,
  ...ObjectTypes,
};
