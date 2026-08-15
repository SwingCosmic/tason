import type { TASONTypeInfo } from "tason";

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

/** 阶段 C 三步：C1 新标量 / C2 鸭子类型追加 / C3 Binary 子类型 */
export type MongoTypeWave = "C1" | "C2" | "C3";

export interface MongoTypeSpec {
  /** 注册到的 TypeName */
  typeName: MongoTypeName;
  /** new = 新 TypeName；append = 挂到核心已有 TypeName */
  strategy: MongoTypeStrategy;
  /** 仅 append 项可被 replaceDefaultImplementation 置顶 */
  canReplaceDefault?: boolean;
  /** 仅当 registry.allowUnsafeTypes 时登记（与核心 Symbol 同一开关） */
  unsafe?: boolean;
  wave: MongoTypeWave;
}

/**
 * 类型矩阵。P0 起往 {@link MongoTypes} 填 TypeInfo；未填的项 register 时跳过。
 * 档位与适配理由只在 phase-c 分册维护，此处不重复。
 */
export const MongoTypeCatalog: readonly MongoTypeSpec[] = [
  { typeName: "ObjectId", strategy: "new", wave: "C1" },
  { typeName: "BSONMinKey", strategy: "new", wave: "C1" },
  { typeName: "BSONMaxKey", strategy: "new", wave: "C1" },
  { typeName: "BSONTimestamp", strategy: "new", wave: "C1" },
  { typeName: "BSONJavaScript", strategy: "new", unsafe: true, wave: "C1" },
  { typeName: "Int64", strategy: "append", canReplaceDefault: true, wave: "C2" },
  { typeName: "Decimal128", strategy: "append", canReplaceDefault: true, wave: "C2" },
  { typeName: "Int32", strategy: "append", canReplaceDefault: true, wave: "C2" },
  { typeName: "Float64", strategy: "append", canReplaceDefault: true, wave: "C2" },
  { typeName: "UUID", strategy: "append", canReplaceDefault: true, wave: "C2" },
  { typeName: "Buffer", strategy: "append", canReplaceDefault: true, wave: "C3" },
  { typeName: "MD5", strategy: "new", wave: "C3" },
  { typeName: "BSONEncrypted", strategy: "new", wave: "C3" },
  { typeName: "BSONSensitive", strategy: "new", wave: "C3" },
  { typeName: "BSONVector", strategy: "new", wave: "C3" },
];

export const ALL_MONGO_TYPE_NAMES: readonly MongoTypeName[] =
  MongoTypeCatalog.map((spec) => spec.typeName);

/**
 * 类型实现表。按 catalog 所属步骤（C1–C3）填入；测试与高级定制可覆盖。
 */
export const MongoTypes: Partial<Record<MongoTypeName, TASONTypeInfo<any>>> = {};
