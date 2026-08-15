/**
 * tason-mongodb — MongoDB / BSON TypeName extensions for TASON.
 *
 * 注册骨架已落地；TypeInfo 按 C1 / C2 / C3 填入。
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
} from "./types";
export type {
  MongoTypeName,
  MongoTypeSpec,
  MongoTypeStrategy,
  MongoTypeWave,
} from "./types";
