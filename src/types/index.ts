import { defineType, TASONTypeInfo } from "./TASONTypeInfo";
import NumberTypes from "./numbers";
import { SymbolTypeInfo } from "./Symbol";
import JSONTypes from "./json";
import { RegExpTypeInfo } from "./RegExp";
import { BufferTypeInfo } from "./Buffer";
import { UUIDTypeInfo } from "./UUID";
import DateTypes from "./date";

export const unsafeTypes = ["Symbol"];

export const ScalarTypes = {
  ...NumberTypes,
  ...JSONTypes,
  ...DateTypes,
  RegExp: RegExpTypeInfo,
  Symbol: SymbolTypeInfo,
  Buffer: BufferTypeInfo,
  UUID: UUIDTypeInfo,
};

export const ObjectTypes = {};

export const Types = {
  ...ScalarTypes,
  ...ObjectTypes,
};
