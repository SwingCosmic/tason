/**
 * tason-mongodb — MongoDB / BSON TypeName extensions for TASON.
 *
 * 本包只做 TypeName ↔ BSON 值，不做对象图 `_t` / toDocument。
 */

export { registerMongoDBTypes } from "./register";
export type {
  RegisterMongoDBTypesOptions,
  ReplaceDefaultImplementationMap,
} from "./options";
export {
  MongoTypes,
  MongoTypeCatalog,
  ALL_MONGO_TYPE_NAMES,
  mongoTypeInfoList,
} from "./types";
export type {
  MongoTypeName,
  MongoTypeSpec,
  MongoTypeStrategy,
  MongoTypeInfos,
} from "./types";
export { loadDefaultBson, getBson, isBsonBound } from "./bson-ns";
export type { BsonNamespace } from "./bson-ns";
