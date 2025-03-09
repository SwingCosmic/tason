import { TASONTypeInfo } from "./TASONTypeInfo";
import NumberTypes from "./numbers";
import { SymbolTypeInfo } from "./js/Symbol";
import JSONTypes from "./json";
import { RegExpTypeInfo } from "./RegExp";
import { BufferTypeInfo } from "./Buffer";
import { UUIDTypeInfo } from "./UUID";
import DateTypes from "./date";
import { DictionaryTypeInfo } from "./Dictionary";

export const unsafeTypes = ["Symbol"];

export const ScalarTypes = {
  ...NumberTypes,
  ...JSONTypes,
  ...DateTypes,
  RegExp: RegExpTypeInfo,
  Symbol: SymbolTypeInfo,
  Dictionary: DictionaryTypeInfo,
  Buffer: BufferTypeInfo,
  UUID: UUIDTypeInfo,
};

export const ObjectTypes = {};

export const Types = {
  ...ScalarTypes,
  ...ObjectTypes,
};


export const unsafeBuiltinCtors = [
  SharedArrayBuffer,
  WeakMap,
  WeakSet,
];

export const typeAlias = {
  Byte: "UInt8",
  Short: "Int16",
  Int: "Int32",
  Long: "Int64",
  Float: "Float32",
  Double: "Float64",
} as const;