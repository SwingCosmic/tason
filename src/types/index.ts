import { TASONTypeInfo } from "./TASONTypeInfo";
import NumberTypes from "./numbers";
import { SymbolTypeInfo } from "./js/Symbol";
import JSONTypes from "./json";
import { RegExpTypeInfo } from "./RegExp";
import { BufferTypeInfo } from "./Buffer";
import { UUIDTypeInfo } from "./UUID";
import DateTypes from "./date";
import { DictionaryTypeInfo } from "./Dictionary";
import { Constructor } from "type-fest";

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
  WeakMap,
  WeakSet,
] as Constructor<any>[];
// 由于安全限制，部分情况下浏览器不提供SharedArrayBuffer构造函数
if (typeof SharedArrayBuffer === "function") {
  unsafeBuiltinCtors.push(SharedArrayBuffer);
}

export const typeAlias = {
  Byte: "UInt8",
  Short: "Int16",
  Int: "Int32",
  Long: "Int64",
  Single: "Float32",
  Double: "Float64",
} as const;