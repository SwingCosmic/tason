import { afterAll, beforeAll, expect, test } from "@jest/globals";
import { Binary, Decimal128, Long, ObjectId, UUID } from "bson";
import { Collection, MongoClient } from "mongodb";
import {
  MD5_CHECKSUM,
  MD5_CHUNK,
  OID_ASSET,
  OID_NATIVE,
  SPAN_A,
  SPAN_B,
  UNSAFE_INT64,
  UUID_TEXT,
  type AssetPayload,
  AssetRecord,
  type OrderPayload,
  OrderRecord,
  assetRequestText,
  createApiSerializer,
  maybeDescribe,
  mongoTestConfig,
  toAssetRecord,
  toOrderRecord,
} from "./integration.shared";

/**
 * C 集成（原生 mongodb 驱动）：请求文本 parseAs 实体后写入集合；
 * findOne / find 结果映射实体后 stringify 为 API 响应文本并回环。
 * 连接信息与共享夹具见 integration.shared.ts / env.ts，未配置自动 skip。
 */

// 模拟客户端提交的 TASON 请求文本：
// 数值字段走字面量 / 核心包装（bigint 契约只认这两者），
// 动态字段里的 Int64 / Decimal128 / UUID 在 replaceDefault 后得到 bson 实现。
const orderRequestText = [
  "OrderRecord({",
  `_id:ObjectId("${OID_NATIVE}"),`,
  'code:"ORD-001",',
  "quantity:3,",
  'amount:Decimal128("114514.1919"),',
  `payload:{traceId:UUID("${UUID_TEXT}"),span:Int64("${UNSAFE_INT64}"),tags:["first","second"]},`,
  'createdAt:Date("2026-08-16T02:03:04.005Z")',
  "})",
].join("");

maybeDescribe("mongodb native driver integration", () => {
  const NATIVE_COLLECTION = "tason_orders_native";
  const ASSET_COLLECTION = "tason_assets_native";
  let client: MongoClient;
  let collection: Collection;
  let assets: Collection;

  beforeAll(async () => {
    client = new MongoClient(mongoTestConfig.uri);
    await client.connect();
    const db = client.db(mongoTestConfig.dbName);
    await db
      .collection(NATIVE_COLLECTION)
      .drop()
      .catch(() => undefined);
    await db
      .collection(ASSET_COLLECTION)
      .drop()
      .catch(() => undefined);
    collection = db.collection(NATIVE_COLLECTION);
    assets = db.collection(ASSET_COLLECTION);
  });

  afterAll(async () => {
    if (!client) return;
    const db = client.db(mongoTestConfig.dbName);
    await db
      .collection(NATIVE_COLLECTION)
      .drop()
      .catch(() => undefined);
    await db
      .collection(ASSET_COLLECTION)
      .drop()
      .catch(() => undefined);
    await client.close();
  });

  test("OrderRecord 请求文本 parseAs 实体后 insertOne", async () => {
    const s = createApiSerializer();
    const order = s.parseAs(OrderRecord, orderRequestText);

    expect(order).toBeInstanceOf(OrderRecord);
    expect(order._id!.toHexString()).toBe(OID_NATIVE);
    expect(order.quantity).toBe(3n);
    expect(order.amount).toBeInstanceOf(Decimal128);
    expect(order.amount.toString()).toBe("114514.1919");
    expect(order.createdAt).toEqual(new Date("2026-08-16T02:03:04.005Z"));
    // 动态字段：unknown 契约透传，replaceDefault 后保留 bson 实现
    const payload = order.payload as OrderPayload;
    expect(payload.traceId).toBeInstanceOf(UUID);
    expect(payload.span).toBeInstanceOf(Long);
    expect(payload.span!.toString()).toBe(UNSAFE_INT64);

    const res = await collection.insertOne(order);
    expect(res.insertedId.toHexString()).toBe(OID_NATIVE);
  });

  test("findOne 文档映射实体后 stringify 为 API 响应文本", async () => {
    const s = createApiSerializer();
    const raw = await collection.findOne({ _id: new ObjectId(OID_NATIVE) });
    expect(raw).not.toBeNull();
    // 单一 bson 副本：驱动返回的实例即本测试 import 的类（instanceof 可识别）
    expect(raw!._id).toBeInstanceOf(ObjectId);
    expect(raw!.amount).toBeInstanceOf(Decimal128);
    const payload = raw!.payload as OrderPayload;
    // 超安全范围的 long 不被 promoteValues 提升为 number
    expect(payload.span).toBeInstanceOf(Long);
    expect(payload.traceId).toBeInstanceOf(UUID);
    // 安全 long（无此场景）与 int 会被驱动提升为 number，应用层按契约收敛
    expect(raw!.quantity).toBe(3);

    const body = s.stringify(toOrderRecord(raw!));
    expect(body.startsWith("OrderRecord(")).toBe(true);
    expect(body).toContain(`_id:ObjectId("${OID_NATIVE}")`);
    expect(body).toContain(`amount:Decimal128("114514.1919")`);
    expect(body).toContain(`span:Int64("${UNSAFE_INT64}")`);
    expect(body).toContain(`traceId:UUID("${UUID_TEXT}")`);
    // 安全 bigint（unsafe-only 默认）写裸字面量；毫秒 Date 保持 ISO 文本
    expect(body).toContain("quantity:3,");
    expect(body).toContain(`createdAt:Date("2026-08-16T02:03:04.005Z")`);

    // 客户端解析响应：schema 契约收敛，动态字段继续保留 bson 实现
    const echoed = s.parseAs(OrderRecord, body);
    expect(echoed._id!.toHexString()).toBe(OID_NATIVE);
    expect(echoed.quantity).toBe(3n);
    expect(echoed.amount.toString()).toBe("114514.1919");
    const echoPayload = echoed.payload as OrderPayload;
    expect(echoPayload.span!.toString()).toBe(UNSAFE_INT64);
    expect(echoPayload.traceId!.toString()).toBe(UUID_TEXT);
    expect(echoPayload.tags).toEqual(["first", "second"]);
  });

  test("parse 得到的 bson 值用于 updateOne 与查询过滤", async () => {
    const s = createApiSerializer();
    const newAmount = s.parse<Decimal128>(`Decimal128("888.75")`);
    expect(newAmount).toBeInstanceOf(Decimal128);
    await collection.updateOne(
      { _id: new ObjectId(OID_NATIVE) },
      { $set: { amount: newAmount } },
    );

    // 动态字段里的 Long（parse 自 Int64 文本）直接作为查询条件
    const spanFilter = s.parse<Long>(`Int64("${UNSAFE_INT64}")`);
    const hits = await collection
      .find({ "payload.span": spanFilter })
      .toArray();
    expect(hits).toHaveLength(1);
    expect(hits[0].amount.toString()).toBe("888.75");
    expect(s.stringify(toOrderRecord(hits[0]))).toContain(
      `amount:Decimal128("888.75")`,
    );
  });

  test("AssetRecord 数值装箱数组与 Binary 家族 parseAs 后 insertOne", async () => {
    const s = createApiSerializer();
    const asset = s.parseAs(AssetRecord, assetRequestText);

    expect(asset).toBeInstanceOf(AssetRecord);
    // Int64[]：instance 契约保留 bson.Long 装箱
    expect(asset.spans).toHaveLength(2);
    for (const span of asset.spans) {
      expect(span).toBeInstanceOf(Long);
    }
    expect(asset.spans.map((x) => x.toString())).toEqual([SPAN_A, SPAN_B]);
    // 字面量与 BigInt 文本收敛为原生 bigint
    expect(asset.counts).toEqual([2n, 9007199254740993n]);
    expect(asset.amounts.map((x) => x.toString())).toEqual(["19.25", "-0.125"]);
    // Binary 家族：契约只认 Binary 基类，subtype 语义由 TypeName 文本决定
    expect(asset.thumbnail).toBeInstanceOf(Binary);
    expect(asset.thumbnail.sub_type).toBe(Binary.SUBTYPE_DEFAULT);
    expect(asset.thumbnail.toString("utf8")).toBe("hello");
    const payload = asset.payload as AssetPayload;
    expect(payload.checksum!.sub_type).toBe(Binary.SUBTYPE_MD5);
    expect(payload.sealed!.sub_type).toBe(Binary.SUBTYPE_ENCRYPTED);
    expect(payload.hidden!.sub_type).toBe(Binary.SUBTYPE_SENSITIVE);
    expect(payload.embedding!.sub_type).toBe(Binary.SUBTYPE_VECTOR);
    expect(Array.from(payload.embedding!.toInt8Array())).toEqual([1, -2, 3]);
    expect(Array.from(payload.flags!.toPackedBits())).toEqual([255, 15]);
    expect(Array.from(payload.spectrum!.toFloat32Array())).toEqual([
      1.5, -2.25,
    ]);
    // 动态字段内的二进制数组：subtype 各自保留
    expect(payload.chunks![0].sub_type).toBe(Binary.SUBTYPE_DEFAULT);
    expect(payload.chunks![1].sub_type).toBe(Binary.SUBTYPE_MD5);

    const res = await assets.insertOne(asset);
    expect(res.insertedId.toHexString()).toBe(OID_ASSET);
  });

  test("AssetRecord 二进制文档 findOne 后 stringify 响应并回环", async () => {
    const s = createApiSerializer();
    // MD5 文本 parse 出的 Binary(5) 直接作为查询条件（subtype 参与匹配）
    const checksumFilter = s.parse<Binary>(`MD5("${MD5_CHECKSUM}")`);
    const raw = await assets.findOne({ "payload.checksum": checksumFilter });
    expect(raw).not.toBeNull();
    // promoteBuffers 默认 false：Binary 实例与 subtype 原样读回
    expect(raw!.thumbnail.sub_type).toBe(Binary.SUBTYPE_DEFAULT);
    expect(raw!.thumbnail.toString("utf8")).toBe("hello");
    const stored = raw!.payload as AssetPayload;
    expect(stored.checksum!.toString("hex")).toBe(MD5_CHECKSUM);
    expect(stored.sealed!.toString("hex")).toBe("0001020304");
    expect(stored.hidden!.toString("hex")).toBe("cafebabe");
    expect(Array.from(stored.embedding!.toInt8Array())).toEqual([1, -2, 3]);
    expect(Array.from(stored.flags!.toPackedBits())).toEqual([255, 15]);
    expect(Array.from(stored.spectrum!.toFloat32Array())).toEqual([1.5, -2.25]);
    // 数值数组：装箱 long（超安全范围）不提升；bigint 存的 long 安全值被提升
    expect(raw!.spans).toHaveLength(2);
    for (const span of raw!.spans) {
      expect(span).toBeInstanceOf(Long);
    }
    expect(raw!.counts[0]).toBe(2);
    expect(raw!.counts[1]).toBeInstanceOf(Long);

    const body = s.stringify(toAssetRecord(raw!));
    expect(body.startsWith("AssetRecord(")).toBe(true);
    expect(body).toContain(`thumbnail:Buffer("base64,aGVsbG8=")`);
    expect(body).toContain(`spans:[Int64("${SPAN_A}"),Int64("${SPAN_B}")]`);
    expect(body).toContain(`counts:[2,BigInt("9007199254740993")]`);
    expect(body).toContain(
      `amounts:[Decimal128("19.25"),Decimal128("-0.125")]`,
    );
    expect(body).toContain(`checksum:MD5("${MD5_CHECKSUM}")`);
    expect(body).toContain(`sealed:BSONEncrypted("base64,AAECAwQ=")`);
    // 文本形式统一 base64：hex 前缀输入读回后写 base64
    expect(body).toContain(`hidden:BSONSensitive("base64,yv66vg==")`);
    expect(body).toContain(
      `embedding:BSONVector({dtype:"int8",values:[1,-2,3]})`,
    );
    expect(body).toContain(
      `flags:BSONVector({dtype:"packedBit",values:[255,15],padding:4})`,
    );
    expect(body).toContain(
      `spectrum:BSONVector({dtype:"float32",values:[1.5,-2.25]})`,
    );
    expect(body).toContain(
      `chunks:[Buffer("base64,3q2+7w=="),MD5("${MD5_CHUNK}")]`,
    );

    // 回环：subtype 语义与数值精度保持
    const echoed = s.parseAs(AssetRecord, body);
    expect(echoed.thumbnail!.toString("utf8")).toBe("hello");
    expect(echoed.spans.map((x) => x.toString())).toEqual([SPAN_A, SPAN_B]);
    expect(echoed.counts).toEqual([2n, 9007199254740993n]);
    expect(echoed.amounts.map((x) => x.toString())).toEqual(["19.25", "-0.125"]);
    const echoPayload = echoed.payload as AssetPayload;
    expect(echoPayload.hidden!.toString("hex")).toBe("cafebabe");
    expect(echoPayload.sealed!.toString("hex")).toBe("0001020304");
    expect(Array.from(echoPayload.embedding!.toInt8Array())).toEqual([1, -2, 3]);
    expect(Array.from(echoPayload.flags!.toPackedBits())).toEqual([255, 15]);
    expect(Array.from(echoPayload.spectrum!.toFloat32Array())).toEqual([
      1.5, -2.25,
    ]);
  });
});
