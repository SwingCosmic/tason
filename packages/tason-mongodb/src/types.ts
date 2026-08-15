import type { TASONTypeInfo } from "tason";
import {
  BSONEncryptedTypeInfo,
  BSONJavaScriptTypeInfo,
  BSONMaxKeyTypeInfo,
  BSONMinKeyTypeInfo,
  BSONSensitiveTypeInfo,
  BSONTimestampTypeInfo,
  BSONVectorTypeInfo,
  BufferTypeInfo,
  Decimal128TypeInfo,
  Float64TypeInfo,
  Int32TypeInfo,
  Int64TypeInfo,
  MD5TypeInfo,
  ObjectIdTypeInfo,
  UUIDBinaryTypeInfo,
  UUIDTypeInfo,
} from "./typeInfos";

/**
 * 本包可注册的 TypeName（对应官方 BSON 表，见
 * `docs/features/monorepo/phase-c-bson-types.md`）。
 * 追加项用核心已有名；仅 BSON 内部语义的 TypeName 以 `BSON` 开头
 *（`BSONTimestamp` 不占用核心毫秒 `Timestamp`）。
 */
export type MongoTypeName =
  | "ObjectId"
  | "Int64"
  | "Decimal128"
  | "Buffer"
  | "UUID"
  | "MD5"
  | "BSONEncrypted"
  | "BSONSensitive"
  | "BSONVector"
  | "BSONMinKey"
  | "BSONMaxKey"
  | "BSONTimestamp"
  | "Int32"
  | "Float64"
  | "BSONJavaScript";

export type MongoTypeStrategy = "new" | "append";

export interface MongoTypeSpec {
  /** 注册到的 TypeName */
  typeName: MongoTypeName;
  /** new = 新 TypeName；append = 挂到核心已有 TypeName */
  strategy: MongoTypeStrategy;
  /** 仅 append 项可被 replaceDefaultImplementation 置顶 */
  canReplaceDefault?: boolean;
  /** 仅当 registry.allowUnsafeTypes 时登记（与核心 Symbol 同一开关） */
  unsafe?: boolean;
}

/**
 * 类型矩阵。档位与适配理由只在 phase-c 分册维护，此处不重复。
 */
export const MongoTypeCatalog: readonly MongoTypeSpec[] = [
  { typeName: "ObjectId", strategy: "new" },
  { typeName: "BSONMinKey", strategy: "new" },
  { typeName: "BSONMaxKey", strategy: "new" },
  { typeName: "BSONTimestamp", strategy: "new" },
  { typeName: "BSONJavaScript", strategy: "new", unsafe: true },
  { typeName: "Int64", strategy: "append", canReplaceDefault: true },
  { typeName: "Decimal128", strategy: "append", canReplaceDefault: true },
  { typeName: "Int32", strategy: "append", canReplaceDefault: true },
  { typeName: "Float64", strategy: "append", canReplaceDefault: true },
  { typeName: "UUID", strategy: "append", canReplaceDefault: true },
  { typeName: "Buffer", strategy: "append", canReplaceDefault: true },
  { typeName: "MD5", strategy: "new" },
  { typeName: "BSONEncrypted", strategy: "new" },
  { typeName: "BSONSensitive", strategy: "new" },
  { typeName: "BSONVector", strategy: "new" },
];

export const ALL_MONGO_TYPE_NAMES: readonly MongoTypeName[] =
  MongoTypeCatalog.map((spec) => spec.typeName);

/** 同一 TypeName 可挂多条实现（如 UUID + Binary subtype 3/4）。 */
export type MongoTypeInfos =
  | TASONTypeInfo<any>
  | readonly TASONTypeInfo<any>[];

/**
 * 类型实现表。测试与高级定制可覆盖。
 */
export const MongoTypes: Record<MongoTypeName, MongoTypeInfos> = {
  ObjectId: ObjectIdTypeInfo,
  BSONMinKey: BSONMinKeyTypeInfo,
  BSONMaxKey: BSONMaxKeyTypeInfo,
  BSONTimestamp: BSONTimestampTypeInfo,
  BSONJavaScript: BSONJavaScriptTypeInfo,
  Int64: Int64TypeInfo,
  Decimal128: Decimal128TypeInfo,
  Int32: Int32TypeInfo,
  Float64: Float64TypeInfo,
  UUID: [UUIDTypeInfo, UUIDBinaryTypeInfo],
  Buffer: BufferTypeInfo,
  MD5: MD5TypeInfo,
  BSONEncrypted: BSONEncryptedTypeInfo,
  BSONSensitive: BSONSensitiveTypeInfo,
  BSONVector: BSONVectorTypeInfo,
};

export function mongoTypeInfoList(
  entry: MongoTypeInfos | undefined,
): TASONTypeInfo<any>[] {
  if (!entry) return [];
  return Array.isArray(entry) ? [...entry] : [entry];
}
