import { describe, expect, test } from "@jest/globals";
import {
  Binary,
  Code,
  Decimal128,
  Double,
  Int32,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
  UUID,
} from "bson";
import TASON from "tason";
import { registerMongoDBTypes } from "../src";

/**
 * A：TypeName ↔ bson 类（往返 / instanceof / _bsontype）
 */

const OID_HEX = "6670f391dcb0bd791cb3bd18";
const UUID_TEXT = "3e5b933e-adc1-48a8-b0f8-30aa701cfd77";
const UNSAFE_INT64 = "6571037680684232705";

function createSerializer(
  options?: ConstructorParameters<typeof TASON.Serializer>[0],
) {
  const s = new TASON.Serializer({ indent: false, ...options });
  registerMongoDBTypes(s.registry);
  return s;
}

describe("mongo types", () => {
  test("ObjectId roundtrip", () => {
    const s = createSerializer();
    const parsed = s.parse(`ObjectId("${OID_HEX}")`);
    expect(parsed).toBeInstanceOf(ObjectId);
    expect(parsed._bsontype).toBe("ObjectId");
    expect(s.stringify(parsed)).toBe(`ObjectId("${OID_HEX}")`);
  });

  test("ObjectId invalid hex", () => {
    const s = createSerializer();
    expect(() => s.parse(`ObjectId("not-an-oid")`)).toThrow(/Invalid ObjectId/);
  });

  test("ObjectId without register", () => {
    const s = new TASON.Serializer({ indent: false });
    expect(() => s.parse(`ObjectId("${OID_HEX}")`)).toThrow(/Unregistered type/);
  });

  test("BSONMinKey / BSONMaxKey", () => {
    const s = createSerializer();
    const min = s.parse(`BSONMinKey("")`);
    const max = s.parse(`BSONMaxKey("")`);
    expect(min).toBeInstanceOf(MinKey);
    expect(max).toBeInstanceOf(MaxKey);
    expect(min._bsontype).toBe("MinKey");
    expect(max._bsontype).toBe("MaxKey");
    expect(s.stringify(new MinKey())).toBe(`BSONMinKey("")`);
    expect(s.stringify(new MaxKey())).toBe(`BSONMaxKey("")`);
    // 无载荷标量，非空字符串拒绝
    expect(() => s.parse(`BSONMinKey("x")`)).toThrow(/payload/);
  });

  test("BSONTimestamp", () => {
    const s = createSerializer();
    const parsed = s.parse(`BSONTimestamp({t:1700000000,i:1})`);
    expect(parsed).toBeInstanceOf(Timestamp);
    expect(parsed._bsontype).toBe("Timestamp");
    expect(parsed.t).toBe(1700000000);
    expect(parsed.i).toBe(1);
    expect(s.stringify(parsed)).toBe(`BSONTimestamp({t:1700000000,i:1})`);
    expect(() => s.parse(`BSONTimestamp({})`)).toThrow(/numeric t and i/);
  });

  test("BSONTimestamp vs Timestamp", () => {
    const s = createSerializer();
    // 核心毫秒 Timestamp 仍是默认；bson.Timestamp 写出 BSONTimestamp
    expect(s.registry.getDefaultType("Timestamp")!.ctor).not.toBe(Timestamp);
    expect(s.stringify(new Timestamp({ t: 1, i: 2 }))).toBe(
      `BSONTimestamp({t:1,i:2})`,
    );
  });

  test("BSONJavaScript", () => {
    const s = createSerializer({ allowUnsafeTypes: true });
    const parsed = s.parse(`BSONJavaScript("db.foo.find()")`);
    expect(parsed).toBeInstanceOf(Code);
    expect(parsed._bsontype).toBe("Code");
    expect(parsed.code).toBe("db.foo.find()");
    expect(s.stringify(parsed)).toBe(`BSONJavaScript("db.foo.find()")`);
  });

  test("BSONJavaScript with scope", () => {
    const s = createSerializer({ allowUnsafeTypes: true });
    expect(() => s.stringify(new Code("return x", { x: 1 }))).toThrow(/scope/);
  });

  test("Int64 stringify Long", () => {
    const s = createSerializer();
    const long = Long.fromString(UNSAFE_INT64);
    expect(s.stringify(long)).toBe(`Int64("${UNSAFE_INT64}")`);
    // Timestamp 继承 Long，仍走 BSONTimestamp
    expect(s.stringify(new Timestamp({ t: 1, i: 2 }))).toBe(
      `BSONTimestamp({t:1,i:2})`,
    );
  });

  test("Int64 parse default", () => {
    const s = createSerializer();
    // 未 replaceDefault：拆箱为 bigint，不是 Long
    const parsed = s.parse(`Int64("${UNSAFE_INT64}")`);
    expect(parsed).toBe(BigInt(UNSAFE_INT64));
    expect(parsed).not.toBeInstanceOf(Long);
  });

  test("Decimal128 stringify", () => {
    const s = createSerializer();
    const dec = Decimal128.fromString("114514.1919");
    expect(s.stringify(dec)).toBe(`Decimal128("114514.1919")`);
  });

  test("Decimal128 parse default", () => {
    const s = createSerializer();
    const parsed = s.parse(`Decimal128("114514.1919")`);
    expect(parsed).not.toBeInstanceOf(Decimal128);
    expect(String(parsed)).toBe("114514.1919");
  });

  test("Int32 / Float64 stringify", () => {
    const s = createSerializer();
    expect(s.stringify(new Int32(42))).toBe(`Int32("42")`);
    expect(s.stringify(new Double(1.5))).toBe(`Float64("1.5")`);
  });

  test("Int32 / Float64 parse default", () => {
    const s = createSerializer();
    expect(s.parse(`Int32("42")`)).toBe(42);
    expect(s.parse(`Float64("1.5")`)).toBe(1.5);
  });

  test("UUID stringify", () => {
    const s = createSerializer();
    const uuid = new UUID(UUID_TEXT);
    expect(s.stringify(uuid)).toBe(`UUID("${UUID_TEXT}")`);
    // Binary subtype 3/4 写出 UUID；parse 回去是 subtype 4
    const bytes = uuid.id;
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_UUID))).toBe(
      `UUID("${UUID_TEXT}")`,
    );
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_UUID_OLD))).toBe(
      `UUID("${UUID_TEXT}")`,
    );
  });

  test("UUID parse default", () => {
    const s = createSerializer();
    const parsed = s.parse(`UUID("${UUID_TEXT}")`);
    expect(parsed).not.toBeInstanceOf(UUID);
    expect(parsed.value).toBe(UUID_TEXT);
  });

  test("Buffer remaining subtypes", () => {
    const s = createSerializer();
    const bytes = Uint8Array.of(0x61);
    // 0/1/2/7/128 写出 Buffer；3/4 仍是 UUID
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_DEFAULT))).toBe(
      `Buffer("base64,YQ==")`,
    );
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_FUNCTION))).toBe(
      `Buffer("base64,YQ==")`,
    );
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_BYTE_ARRAY))).toBe(
      `Buffer("base64,YQ==")`,
    );
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_COLUMN))).toBe(
      `Buffer("base64,YQ==")`,
    );
    expect(s.stringify(new Binary(bytes, Binary.SUBTYPE_USER_DEFINED))).toBe(
      `Buffer("base64,YQ==")`,
    );
    const uuidBytes = new UUID(UUID_TEXT).id;
    expect(s.stringify(new Binary(uuidBytes, Binary.SUBTYPE_UUID))).toBe(
      `UUID("${UUID_TEXT}")`,
    );
  });

  test("Buffer parse default", () => {
    const s = createSerializer();
    // 未 replaceDefault：核心 Buffer；用户 subtype 文本不保留
    const parsed = s.parse(`Buffer("base64,YQ==")`);
    expect(parsed).toBeInstanceOf(TASON.Types.Buffer.ctor);
    expect(parsed).not.toBeInstanceOf(Binary);
    expect(parsed.toString()).toBe("base64,YQ==");
  });

  test("MD5", () => {
    const s = createSerializer();
    const hex = "00112233445566778899aabbccddeeff";
    const parsed = s.parse(`MD5("${hex}")`);
    expect(parsed).toBeInstanceOf(Binary);
    expect(parsed.sub_type).toBe(Binary.SUBTYPE_MD5);
    expect(s.stringify(parsed)).toBe(`MD5("${hex}")`);
    expect(() => s.parse(`MD5("zz")`)).toThrow(/Invalid MD5/);
  });

  test("BSONEncrypted / BSONSensitive", () => {
    const s = createSerializer();
    const enc = s.parse(`BSONEncrypted("base64,YQ==")`);
    const sens = s.parse(`BSONSensitive("hex,61")`);
    expect(enc).toBeInstanceOf(Binary);
    expect(sens).toBeInstanceOf(Binary);
    expect(enc.sub_type).toBe(Binary.SUBTYPE_ENCRYPTED);
    expect(sens.sub_type).toBe(Binary.SUBTYPE_SENSITIVE);
    // hex 读入后按 base64 写出
    expect(s.stringify(enc)).toBe(`BSONEncrypted("base64,YQ==")`);
    expect(s.stringify(sens)).toBe(`BSONSensitive("base64,YQ==")`);
  });

  test("BSONVector", () => {
    const s = createSerializer();
    const int8 = s.parse(`BSONVector({dtype:"int8",values:[1,-2,3]})`);
    expect(int8).toBeInstanceOf(Binary);
    expect(int8.sub_type).toBe(Binary.SUBTYPE_VECTOR);
    expect(Array.from(int8.toInt8Array())).toEqual([1, -2, 3]);
    expect(s.stringify(int8)).toBe(
      `BSONVector({dtype:"int8",values:[1,-2,3]})`,
    );

    const f32 = Binary.fromFloat32Array(Float32Array.from([1.5, 2.25]));
    expect(s.stringify(f32)).toBe(
      `BSONVector({dtype:"float32",values:[1.5,2.25]})`,
    );
    expect(Array.from(s.parse(s.stringify(f32)).toFloat32Array())).toEqual([
      1.5, 2.25,
    ]);

    // padding≠0 才写出；读入走 fromPackedBits
    const bits = Binary.fromPackedBits(Uint8Array.of(0b1010_0000), 4);
    expect(s.stringify(bits)).toBe(
      `BSONVector({dtype:"packedBit",values:[160],padding:4})`,
    );
    const parsedBits = s.parse(s.stringify(bits));
    expect(Array.from(parsedBits.toPackedBits())).toEqual([160]);
    expect(parsedBits.buffer[1]).toBe(4);
  });
});
