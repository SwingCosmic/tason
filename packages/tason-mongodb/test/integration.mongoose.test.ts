import { afterAll, beforeAll, expect, test } from "@jest/globals";
import { Binary, Decimal128, Long, ObjectId } from "bson";
import mongoose from "mongoose";
import mongooseLong from "mongoose-long";
import {
  MD5_CHECKSUM,
  OID_ASSET,
  OID_MONGOOSE,
  SPAN_A,
  SPAN_B,
  UNSAFE_INT64_MONGOOSE,
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
 * C 集成（mongoose）：请求文本 parseAs 实体后 Model.create；
 * lean() / toObject() 结果映射实体后 stringify 为 API 响应文本并回环。
 * 另含 mongoose-long（Schema.Types.Long）路径：字段与数组的值即 bson.Long。
 * 连接信息与共享夹具见 integration.shared.ts / env.ts，未配置自动 skip。
 */

// 注册 Schema.Types.Long（值类型为 mongoose.mongo.Long，与 bson.Long 同一副本）
mongooseLong(mongoose);

const mongooseRequestText = [
  "OrderRecord({",
  `_id:ObjectId("${OID_MONGOOSE}"),`,
  'code:"ORD-101",',
  // 超出安全范围的 bigint：裸字面量会丢精度，必须走 BigInt 文本
  'quantity:BigInt("9007199254740993"),',
  'amount:Decimal128("19.25"),',
  `payload:{level:Int64("${UNSAFE_INT64_MONGOOSE}"),note:"from tason"},`,
  'createdAt:Date("2026-08-16T08:00:00.000Z")',
  "})",
].join("");

maybeDescribe("mongoose integration", () => {
  const MONGOOSE_COLLECTION = "tason_orders_mongoose";

  const MongooseOrderSchema = new mongoose.Schema(
    {
      code: { type: String, required: true },
      // BigInt SchemaType：水合文档内存为原生 bigint（走核心 BigInt 路径）；
      // lean() 绕过 cast 管线，读到的是原始 bson.Long
      quantity: { type: mongoose.Schema.Types.BigInt, required: true },
      amount: { type: mongoose.Schema.Types.Decimal128, required: true },
      // Mixed：动态类型字段，bson 实例原样入库
      payload: { type: mongoose.Schema.Types.Mixed, required: true },
      createdAt: { type: Date, required: true },
    },
    { collection: MONGOOSE_COLLECTION },
  );

  const TasonOrder = mongoose.model("TasonOrder", MongooseOrderSchema);

  const MONGOOSE_ASSET_COLLECTION = "tason_assets_mongoose";

  const MongooseAssetSchema = new mongoose.Schema(
    {
      name: { type: String, required: true },
      thumbnail: { type: mongoose.Schema.Types.Mixed, required: true },
      // mongoose 无内置 Long SchemaType：装箱 long 数组走 Mixed 原样存取
      spans: { type: mongoose.Schema.Types.Mixed, required: true },
      counts: { type: mongoose.Schema.Types.Mixed, required: true },
      amounts: [mongoose.Schema.Types.Decimal128],
      payload: { type: mongoose.Schema.Types.Mixed, required: true },
      createdAt: { type: Date, required: true },
    },
    { collection: MONGOOSE_ASSET_COLLECTION },
  );

  const TasonAsset = mongoose.model("TasonAsset", MongooseAssetSchema);

  const MONGOOSE_ORDER_LONG_COLLECTION = "tason_orders_mongoose_long";

  // mongoose-long：Schema.Types.Long 的值即 bson.Long（同一副本）；
  // 写入接受 Long / number / bigint / 十进制字符串（cast 经 fromString 精确转换）
  const MongooseOrderLongSchema = new mongoose.Schema(
    {
      code: { type: String, required: true },
      quantity: { type: mongoose.Schema.Types.Long, required: true },
      amount: { type: mongoose.Schema.Types.Decimal128, required: true },
      payload: { type: mongoose.Schema.Types.Mixed, required: true },
      createdAt: { type: Date, required: true },
    },
    { collection: MONGOOSE_ORDER_LONG_COLLECTION },
  );

  const TasonOrderLong = mongoose.model(
    "TasonOrderLong",
    MongooseOrderLongSchema,
  );

  const MONGOOSE_ASSET_LONG_COLLECTION = "tason_assets_mongoose_long";

  // Long 数组不再依赖 Mixed：元素级 cast + 查询条件 cast
  const MongooseAssetLongSchema = new mongoose.Schema(
    {
      name: { type: String, required: true },
      thumbnail: { type: mongoose.Schema.Types.Mixed, required: true },
      spans: [mongoose.Schema.Types.Long],
      counts: [mongoose.Schema.Types.Long],
      amounts: [mongoose.Schema.Types.Decimal128],
      payload: { type: mongoose.Schema.Types.Mixed, required: true },
      createdAt: { type: Date, required: true },
    },
    { collection: MONGOOSE_ASSET_LONG_COLLECTION },
  );

  const TasonAssetLong = mongoose.model(
    "TasonAssetLong",
    MongooseAssetLongSchema,
  );

  beforeAll(async () => {
    await mongoose.connect(mongoTestConfig.uri, {
      dbName: mongoTestConfig.dbName,
    });
    await TasonOrder.deleteMany({});
    await TasonAsset.deleteMany({});
    await TasonOrderLong.deleteMany({});
    await TasonAssetLong.deleteMany({});
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    await TasonOrder.deleteMany({});
    await TasonAsset.deleteMany({});
    await TasonOrderLong.deleteMany({});
    await TasonAssetLong.deleteMany({});
    await mongoose.disconnect();
  });

  test("OrderRecord 请求文本 parseAs 实体后 Model.create", async () => {
    const s = createApiSerializer();
    const order = s.parseAs(OrderRecord, mongooseRequestText);
    expect(order.quantity).toBe(9007199254740993n);
    expect((order.payload as OrderPayload).level).toBeInstanceOf(Long);

    const created = await TasonOrder.create({ ...order });
    expect(created._id?.toHexString()).toBe(OID_MONGOOSE);
    expect(created.amount).toBeInstanceOf(Decimal128);
    // Mixed 不做 cast，bson 实例原样保留
    expect((created.payload as OrderPayload).level).toBeInstanceOf(Long);
  });

  test("lean() 与 toObject() 文档映射实体后 stringify 为 API 响应文本", async () => {
    const s = createApiSerializer();
    const lean = await TasonOrder.findOne({ code: "ORD-101" }).lean();
    expect(lean).not.toBeNull();
    expect(lean!._id).toBeInstanceOf(ObjectId);
    expect(lean!.amount).toBeInstanceOf(Decimal128);
    // lean() 不走 cast 管线，读回驱动原始值：该字段超安全范围，保持 bson.Long
    // （安全 long 会提升为 number）
    expect(lean!.quantity).toBeInstanceOf(Long);
    expect((lean!.payload as OrderPayload).level).toBeInstanceOf(Long);

    const body = s.stringify(toOrderRecord(lean as Record<string, any>));
    expect(body).toContain(`_id:ObjectId("${OID_MONGOOSE}")`);
    // 超安全范围 bigint（unsafe-only 默认）装箱为 BigInt 文本
    expect(body).toContain(`quantity:BigInt("9007199254740993"),`);
    expect(body).toContain(`amount:Decimal128("19.25")`);
    expect(body).toContain(`level:Int64("${UNSAFE_INT64_MONGOOSE}")`);

    const echoed = s.parseAs(OrderRecord, body);
    expect(echoed.quantity).toBe(9007199254740993n);
    expect(echoed.amount.toString()).toBe("19.25");
    expect((echoed.payload as OrderPayload).level!.toString()).toBe(
      UNSAFE_INT64_MONGOOSE,
    );

    // 非 lean 路径：水合文档经 cast 管线（Long → bigint），再按 README 推荐 toObject 交给 TASON
    const doc = await TasonOrder.findOne({ code: "ORD-101" });
    expect(doc!.quantity).toBe(9007199254740993n);
    const obj = doc!.toObject({ flattenMaps: true });
    expect(obj.quantity).toBe(9007199254740993n);
    expect(s.stringify(toOrderRecord(obj))).toContain(
      `quantity:BigInt("9007199254740993"),`,
    );
  });

  test("parse 得到的 bson 值经 findOneAndUpdate 与 save 写回", async () => {
    const s = createApiSerializer();
    const patchAmount = s.parse<Decimal128>(`Decimal128("20.5")`);
    const updated = await TasonOrder.findOneAndUpdate(
      { code: "ORD-101" },
      { $set: { amount: patchAmount } },
      { new: true },
    ).lean();
    expect(updated!.amount.toString()).toBe("20.5");

    // 动态字段整体替换：parse 的 plain object（内含 Long 实例）直接赋给 Mixed
    const doc = await TasonOrder.findOne({ code: "ORD-101" });
    doc!.payload = s.parse(
      `{level:Int64("${UNSAFE_INT64_MONGOOSE}"),note:"patched"}`,
    );
    await doc!.save();

    const reloaded = await TasonOrder.findOne({ code: "ORD-101" }).lean();
    expect((reloaded!.payload as OrderPayload).note).toBe("patched");
    expect((reloaded!.payload as OrderPayload).level).toBeInstanceOf(Long);
    expect(s.stringify(toOrderRecord(reloaded as Record<string, any>))).toContain(
      `amount:Decimal128("20.5")`,
    );
  });

  test("AssetRecord 经 Model.create 与 lean() 保留 Binary 子类型与数值数组", async () => {
    const s = createApiSerializer();
    const asset = s.parseAs(AssetRecord, assetRequestText);

    const created = await TasonAsset.create({ ...asset });
    expect(created._id?.toHexString()).toBe(OID_ASSET);
    // Decimal128 数组字段经 cast 后仍是 bson 实例
    expect(created.amounts[0]).toBeInstanceOf(Decimal128);
    expect((created.payload as AssetPayload).checksum!.sub_type).toBe(
      Binary.SUBTYPE_MD5,
    );

    const lean = await TasonAsset.findOne({ name: "ASSET-001" }).lean();
    expect(lean).not.toBeNull();
    // lean() 不走 cast / 不提升：Binary 子类型与装箱 long 数组原样读回
    expect(lean!.thumbnail).toBeInstanceOf(Binary);
    expect(lean!.thumbnail.sub_type).toBe(Binary.SUBTYPE_DEFAULT);
    expect(lean!.spans).toHaveLength(2);
    for (const span of lean!.spans) {
      expect(span).toBeInstanceOf(Long);
    }
    expect(lean!.counts.map((x: any) => BigInt(x))).toEqual([
      2n, 9007199254740993n,
    ]);
    expect(lean!.amounts[0]).toBeInstanceOf(Decimal128);
    const leanPayload = lean!.payload as AssetPayload;
    expect(leanPayload.checksum!.sub_type).toBe(Binary.SUBTYPE_MD5);
    expect(leanPayload.embedding!.sub_type).toBe(Binary.SUBTYPE_VECTOR);
    expect(Array.from(leanPayload.spectrum!.toFloat32Array())).toEqual([
      1.5, -2.25,
    ]);

    const body = s.stringify(toAssetRecord(lean as Record<string, any>));
    expect(body).toContain(`spans:[Int64("${SPAN_A}"),Int64("${SPAN_B}")]`);
    expect(body).toContain(
      `embedding:BSONVector({dtype:"int8",values:[1,-2,3]})`,
    );
    expect(body).toContain(`checksum:MD5("${MD5_CHECKSUM}")`);

    const echoed = s.parseAs(AssetRecord, body);
    expect(echoed.counts).toEqual([2n, 9007199254740993n]);
    expect(echoed.spans.map((x) => x.toString())).toEqual([SPAN_A, SPAN_B]);
    expect(
      Array.from((echoed.payload as AssetPayload).embedding!.toInt8Array()),
    ).toEqual([1, -2, 3]);
  });

  test("mongoose-long Long 字段：水合与 lean 一致为 bson.Long", async () => {
    const s = createApiSerializer();
    const order = s.parseAs(OrderRecord, mongooseRequestText);
    expect(order.quantity).toBe(9007199254740993n);

    // bigint 实体值直接写 Long SchemaType：cast 经 toString 精确转换（不丢精度）
    // （自定义 SchemaType 的类型推断不可靠，取值统一走 String()）
    const created = await TasonOrderLong.create({ ...order });
    expect(created.quantity).toBeInstanceOf(Long);
    expect(String(created.quantity)).toBe("9007199254740993");

    // 水合文档与 toObject：cast 后是 bson.Long（BigInt SchemaType 的 bigint 不对称消除）
    const doc = await TasonOrderLong.findOne({ code: "ORD-101" });
    expect(doc!.quantity).toBeInstanceOf(Long);
    const obj = doc!.toObject({ flattenMaps: true });
    expect(obj.quantity).toBeInstanceOf(Long);

    // lean() 不走 cast 管线，读回驱动原始值：该字段超安全范围，保持 bson.Long
    // （安全 long 会被提升为 number；水合路径经 cast 才统一为 Long）
    const lean = await TasonOrderLong.findOne({ code: "ORD-101" }).lean();
    expect(lean!.quantity).toBeInstanceOf(Long);

    // 查询条件 cast：字符串被转成 Long 再匹配（Mixed 字段做不到）
    const hit = await TasonOrderLong.findOne({
      quantity: "9007199254740993",
    }).lean();
    expect(hit).not.toBeNull();

    // 仓储映射收敛 bigint 后按实体契约回环
    const body = s.stringify(toOrderRecord(lean as Record<string, any>));
    expect(body).toContain(`quantity:BigInt("9007199254740993"),`);
    const echoed = s.parseAs(OrderRecord, body);
    expect(echoed.quantity).toBe(9007199254740993n);
  });

  test("mongoose-long Long 数组：类型化路径全程 bson.Long", async () => {
    const s = createApiSerializer();
    const asset = s.parseAs(AssetRecord, assetRequestText);

    // spans（Long 实例透传）与 counts（bigint 经 cast）都按 Long 存储
    const created = await TasonAssetLong.create({ ...asset });
    for (const span of created.spans) {
      expect(span).toBeInstanceOf(Long);
    }
    for (const count of created.counts) {
      expect(count).toBeInstanceOf(Long);
    }
    expect(created.counts.map((x) => String(x))).toEqual([
      "2",
      "9007199254740993",
    ]);

    const lean = await TasonAssetLong.findOne({ name: "ASSET-001" }).lean();
    expect(lean).not.toBeNull();
    // lean() 不走 cast，读回驱动原始值：安全 long 被提升为 number，
    // 超安全 long 保持 bson.Long —— cast 只统一水合路径，仓储映射仍需归一化
    expect(lean!.spans[0]).toBeInstanceOf(Long);
    expect(lean!.counts[0]).toBe(2);
    expect(lean!.counts[1]).toBeInstanceOf(Long);

    // 数组元素级的查询条件 cast（字符串 → Long）
    const hit = await TasonAssetLong.findOne({ spans: SPAN_A }).lean();
    expect(hit).not.toBeNull();

    // TASON 侧：stringify 装箱 Int64，echo 解析（instance 契约）仍是 Long，
    // 不经转换即可写回同一模型
    const body = s.stringify(toAssetRecord(lean as Record<string, any>));
    expect(body).toContain(`spans:[Int64("${SPAN_A}"),Int64("${SPAN_B}")]`);
    const echoed = s.parseAs(AssetRecord, body);
    for (const span of echoed.spans) {
      expect(span).toBeInstanceOf(Long);
    }
    const again = await TasonAssetLong.findOneAndUpdate(
      { name: "ASSET-001" },
      { $set: { spans: echoed.spans } },
      { new: true },
    ).lean();
    expect(again!.spans.map((x: any) => x.toString())).toEqual([SPAN_A, SPAN_B]);
  });
});
