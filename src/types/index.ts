import { defineType, TASONTypeInfo } from "./TASONTypeInfo";
import { defineNumbers } from "./numbers";
import { SymbolTypeInfo } from "./Symbol";
import JSONTypes from "./json";

export const unsafeTypes = ["Symbol"];

export const ScalarTypes = {
  ...defineNumbers(),
  ...JSONTypes,
  Date: defineType({
    kind: "scalar",
    ctor: Date,
    serialize: (value) => value.toISOString(),
    deserialize: (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
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
      const match = value.match(/^\/(.+)\/([gimsuy]*)$/);
      if (match) {
        return new RegExp(match[1], match[2]);
      } else {
        throw new TypeError(`Invalid RegExp: ${value}`);
      }
    },
  }),
  Symbol: SymbolTypeInfo,
};

export const ObjectTypes = {};

export const Types = {
  ...ScalarTypes,
  ...ObjectTypes,
};
