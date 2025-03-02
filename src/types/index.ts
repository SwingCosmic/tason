import { defineType, TASONTypeInfo } from "./TASONTypeInfo";
import NumberTypes from "./numbers";
import { SymbolTypeInfo } from "./Symbol";
import JSONTypes from "./json";
import { RegExpTypeInfo } from "./RegExp";
import { BufferTypeInfo } from "./Buffer";

export const unsafeTypes = ["Symbol"];

export const ScalarTypes = {
  ...NumberTypes,
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
  RegExp: RegExpTypeInfo,
  Symbol: SymbolTypeInfo,
  Buffer: BufferTypeInfo,
};

export const ObjectTypes = {};

export const Types = {
  ...ScalarTypes,
  ...ObjectTypes,
};
