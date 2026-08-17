import { describe, jest } from "@jest/globals";
import * as v from "valibot";
import { Binary, Decimal128, Int32, Long, ObjectId, UUID } from "bson";
import TASON, { createValibotAdapter } from "tason";
import { registerMongoDBTypes } from "../src";
import { getMongoTestConfig } from "./env";

/**
 * C 集成共享夹具：连接配置 / 实体与 schema / API 序列化器装配 / 仓储映射 / 请求文本。
 * 由 integration.mongodb.test.ts 与 integration.mongoose.test.ts 引用；
 * 本文件不以 .test.ts 结尾，不会被 jest 当作套件收集。
 */

jest.setTimeout(60_000);

export const mongoTestConfig = getMongoTestConfig();

/** 未配置真实连接时，两个集成套件整体 skip */
export const maybeDescribe = (() => {
  if (mongoTestConfig.isConfigured) return describe;
  console.warn(
    "[integration] MONGODB_URI 未配置或仍为占位值，跳过集成测试；" +
      "请在 packages/tason-mongodb/.env.local 填写真实连接信息后重跑",
  );
  return describe.skip;
})();

export const OID_NATIVE = "6670f391dcb0bd791cb3bd18";
export const OID_MONGOOSE = "6670f391dcb0bd791cb3bd19";
export const UUID_TEXT = "3e5b933e-adc1-48a8-b0f8-30aa701cfd77";
export const UNSAFE_INT64 = "6571037680684232705";
export const UNSAFE_INT64_MONGOOSE = "6571037680684232706";
export const SPAN_A = "6571037680684232711";
export const SPAN_B = "6571037680684232712";
export const OID_ASSET = "6670f391dcb0bd791cb3bd21";
export const OID_SCORE = "6670f391dcb0bd791cb3bd22";
export const MD5_CHECKSUM = "00112233445566778899aabbccddeeff";
export const MD5_CHUNK = "ffeeddccbbaa99887766554433221100";

/** 动态类型字段（payload）实际携带的形状 */
export interface OrderPayload {
  traceId?: UUID;
  span?: Long;
  level?: Long;
  note?: string;
  tags?: string[];
}

/** 动态类型字段（payload）里的 Int32：parse 后是 bson.Int32，驱动提升后是 number */
export interface ScorePayload {
  hint?: Int32 | number;
}

/** 动态类型字段（payload）实际携带的 Binary 家族形状 */
export interface AssetPayload {
  blob?: Binary;
  checksum?: Binary;
  sealed?: Binary;
  hidden?: Binary;
  embedding?: Binary;
  flags?: Binary;
  spectrum?: Binary;
  chunks?: Binary[];
}

/** 业务实体：挂 valibot schema 契约，payload 为动态类型字段（v.any()） */
export class OrderRecord {
  _id?: ObjectId;
  code!: string;
  quantity!: bigint;
  amount!: Decimal128;
  payload!: unknown;
  createdAt!: Date;

  constructor(init?: Partial<OrderRecord>) {
    if (init) Object.assign(this, init);
  }
}

const OrderRecordSchema = v.object({
  _id: v.optional(v.instance(ObjectId)),
  code: v.string(),
  quantity: v.bigint(),
  amount: v.instance(Decimal128),
  // 动态类型：契约不收敛，按值级结果透传（replaceDefault 后保留 bson 实现）
  payload: v.any(),
  createdAt: v.date(),
});

/**
 * 复杂类型实体：schema 契约数值装箱数组（Int64 / Decimal128 / bigint）+ Binary 家族
 * （typed 字段 instance(Binary) 与动态 payload 混排；subtype 语义由 TypeName 文本决定）
 */
export class AssetRecord {
  _id?: ObjectId;
  name!: string;
  thumbnail!: Binary;
  spans!: Long[];
  counts!: bigint[];
  amounts!: Decimal128[];
  payload!: unknown;
  createdAt!: Date;

  constructor(init?: Partial<AssetRecord>) {
    if (init) Object.assign(this, init);
  }
}

/**
 * Int32 实体：契约是 number。
 * mongoose `Schema.Types.Int32` / 旧插件 mongoose-int32 的 cast 目标都是 number
 *（保证落盘 BSON int），内存不是 bson.Int32。
 */
export class ScoreRecord {
  _id?: ObjectId;
  code!: string;
  score!: number;
  ranks!: number[];
  payload!: unknown;
  createdAt!: Date;

  constructor(init?: Partial<ScoreRecord>) {
    if (init) Object.assign(this, init);
  }
}

const ScoreRecordSchema = v.object({
  _id: v.optional(v.instance(ObjectId)),
  code: v.string(),
  score: v.number(),
  ranks: v.array(v.number()),
  payload: v.any(),
  createdAt: v.date(),
});

const AssetRecordSchema = v.object({
  _id: v.optional(v.instance(ObjectId)),
  name: v.string(),
  thumbnail: v.instance(Binary),
  // Int64[]：instance 契约保留 bson.Long 装箱
  spans: v.array(v.instance(Long)),
  // 字面量 / BigInt 文本收敛为原生 bigint
  counts: v.array(v.bigint()),
  amounts: v.array(v.instance(Decimal128)),
  payload: v.any(),
  createdAt: v.date(),
});

/**
 * 模拟应用层的 API 序列化器：
 * - number handling 全默认（serialize unsafe-only / deserialize object-fallback-native）
 * - registerMongoDBTypes 全量注册并替换默认数值实现（Mongo 优先）
 * - 实体类挂 schema 契约
 */
export function createApiSerializer() {
  const s = new TASON.Serializer({ indent: false });
  s.registry.setSchemaAdapter(createValibotAdapter());
  registerMongoDBTypes(s.registry, { replaceDefaultImplementation: true });
  s.registry.registerType(
    "OrderRecord",
    { kind: "object", ctor: OrderRecord },
    { schema: OrderRecordSchema },
  );
  s.registry.registerType(
    "AssetRecord",
    { kind: "object", ctor: AssetRecord },
    { schema: AssetRecordSchema },
  );
  s.registry.registerType(
    "ScoreRecord",
    { kind: "object", ctor: ScoreRecord },
    { schema: ScoreRecordSchema },
  );
  return s;
}

/** 仓储层映射：驱动文档 → 实体；数量收敛为 bigint，剥离 mongoose 版本键 */
export function toOrderRecord(raw: Record<string, any>): OrderRecord {
  const rest: Record<string, any> = { ...raw };
  delete rest.__v;
  return new OrderRecord({ ...rest, quantity: BigInt(raw.quantity) });
}

/** 仓储层映射：Int32 Schema 两条路径都是 number，仍剥 __v */
export function toScoreRecord(raw: Record<string, any>): ScoreRecord {
  const rest: Record<string, any> = { ...raw };
  delete rest.__v;
  return new ScoreRecord({
    ...rest,
    score: Number(raw.score),
    ranks: (raw.ranks as unknown[]).map((x) => Number(x)),
  });
}

/** 仓储层映射：counts 经驱动提升后 number / Long 混杂，应用层统一收敛为 bigint */
export function toAssetRecord(raw: Record<string, any>): AssetRecord {
  const rest: Record<string, any> = { ...raw };
  delete rest.__v;
  return new AssetRecord({
    ...rest,
    counts: (raw.counts as unknown[]).map((x) => BigInt(x as any)),
  });
}

// 两个套件共用的 Asset 请求文本：
// Binary 家族（通用 Buffer / MD5(5) / Encrypted(6) / Sensitive(8) / Vector(9)；
// 文本前缀 hex / base64 读回后统一写 base64）+ 数值装箱数组。
export const assetRequestText = [
  "AssetRecord({",
  `_id:ObjectId("${OID_ASSET}"),`,
  'name:"ASSET-001",',
  'thumbnail:Buffer("base64,aGVsbG8="),',
  `spans:[Int64("${SPAN_A}"),Int64("${SPAN_B}")],`,
  'counts:[2,BigInt("9007199254740993")],',
  'amounts:[Decimal128("19.25"),Decimal128("-0.125")],',
  "payload:{",
  'blob:Buffer("hex,0badf00d"),',
  `checksum:MD5("${MD5_CHECKSUM}"),`,
  'sealed:BSONEncrypted("base64,AAECAwQ="),',
  'hidden:BSONSensitive("hex,cafebabe"),',
  'embedding:BSONVector({dtype:"int8",values:[1,-2,3]}),',
  'flags:BSONVector({dtype:"packedBit",values:[255,15],padding:4}),',
  'spectrum:BSONVector({dtype:"float32",values:[1.5,-2.25]}),',
  `chunks:[Buffer("hex,deadbeef"),MD5("${MD5_CHUNK}")]`,
  "},",
  'createdAt:Date("2026-08-16T10:00:00.000Z")',
  "})",
].join("");

// typed 字段用字面量：number 契约不收 bson.Int32（Handling 只认核心包装）。
// 装箱 Int32 放在动态 payload，并在 mongoose 测试里单独 parse 后写入 Schema.Types.Int32。
export const scoreRequestText = [
  "ScoreRecord({",
  `_id:ObjectId("${OID_SCORE}"),`,
  'code:"SCR-001",',
  "score:42,",
  "ranks:[1,-3],",
  'payload:{hint:Int32("7")},',
  'createdAt:Date("2026-08-16T12:00:00.000Z")',
  "})",
].join("");
