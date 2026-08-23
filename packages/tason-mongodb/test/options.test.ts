import { describe, expect, test } from "@jest/globals";
import {
  Binary,
  Decimal128,
  deserialize,
  Double,
  Int32,
  Long,
  ObjectId,
  serialize,
  UUID,
} from "bson";
import TASON from "tason";
import { registerMongo } from "./test-bson";

/**
 * B：include / allowUnsafeTypes / replaceDefaultImplementation
 */

const OID_HEX = "6670f391dcb0bd791cb3bd18";
const UUID_TEXT = "3e5b933e-adc1-48a8-b0f8-30aa701cfd77";
const UNSAFE_INT64 = "6571037680684232705";

function createSerializer(
  options?: ConstructorParameters<typeof TASON.Serializer>[0],
) {
  return new TASON.Serializer({ indent: false, ...options });
}

describe("register options", () => {
  test("include subset", () => {
    const s = createSerializer();
    registerMongo(s.registry, { include: ["ObjectId"] });
    expect(s.parse(`ObjectId("${OID_HEX}")`)).toBeInstanceOf(ObjectId);
    expect(() => s.parse(`BSONMinKey("")`)).toThrow(/Unregistered type/);
  });

  test("BSONJavaScript default skip", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    expect(s.registry.getDefaultType("BSONJavaScript")).toBeUndefined();
    expect(() => s.parse(`BSONJavaScript("1+1")`)).toThrow(/Unregistered type/);
  });

  test("BSONJavaScript allowUnsafeTypes", () => {
    const s = createSerializer({ allowUnsafeTypes: true });
    registerMongo(s.registry);
    expect(s.parse(`BSONJavaScript("1+1")`).code).toBe("1+1");
  });

  test("BSONJavaScript include gate", () => {
    const s = createSerializer();
    expect(() =>
      registerMongo(s.registry, { include: ["BSONJavaScript"] }),
    ).toThrow(/allowUnsafeTypes/);

    const unsafe = createSerializer({ allowUnsafeTypes: true });
    registerMongo(unsafe.registry, { include: ["BSONJavaScript"] });
    expect(unsafe.parse(`BSONJavaScript("x")`).code).toBe("x");
  });

  test("replaceDefault all", () => {
    const s = createSerializer();
    registerMongo(s.registry, { replaceDefaultImplementation: true });
    expect(s.parse(`Int64("1")`)).toBeInstanceOf(Long);
    expect(s.parse(`Decimal128("1.25")`)).toBeInstanceOf(Decimal128);
    expect(s.parse(`Int32("42")`)).toBeInstanceOf(Int32);
    expect(s.parse(`Float64("1.5")`)).toBeInstanceOf(Double);
    expect(s.parse(`UUID("${UUID_TEXT}")`)).toBeInstanceOf(UUID);
    const buf = s.parse(`Buffer("base64,YQ==")`);
    expect(buf).toBeInstanceOf(Binary);
    expect(buf.sub_type).toBe(Binary.SUBTYPE_DEFAULT);
  });

  test("replaceDefault per name", () => {
    const s = createSerializer();
    registerMongo(s.registry, {
      replaceDefaultImplementation: { Int64: true },
    });
    expect(s.parse(`Int64("1")`)).toBeInstanceOf(Long);
    // 未点名的仍走核心拆箱
    expect(s.parse(`Int32("42")`)).toBe(42);
  });

  test("parseAs Long", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    const once = s.parseAs(Long, `Int64("1")`);
    expect(once).toBeInstanceOf(Long);
    expect(once.toString()).toBe("1");
    // 不改全局默认
    expect(s.parse(`Int64("1")`)).toBe(1n);
  });

  test("promoteLongs vs Long instance", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    // 驱动 promoteLongs: true → 安全整数是 number，走字面量
    expect(s.stringify(1)).toBe("1");
    // promoteLongs: false → Long 实例写出 Int64
    expect(s.stringify(Long.fromInt(1))).toBe(`Int64("1")`);
  });

  test("replaceDefault Buffer", () => {
    const s = createSerializer();
    registerMongo(s.registry, {
      replaceDefaultImplementation: { Buffer: true },
    });
    const parsed = s.parse(`Buffer("hex,61")`);
    expect(parsed).toBeInstanceOf(Binary);
    expect(parsed.sub_type).toBe(Binary.SUBTYPE_DEFAULT);
    // 未点名的仍走核心拆箱
    expect(s.parse(`Int32("42")`)).toBe(42);
  });

  test("promoteBuffers vs Binary instance", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    const md5Hex = "00112233445566778899aabbccddeeff";
    const md5 = Binary.createFromHexString(md5Hex, Binary.SUBTYPE_MD5);
    const raw = serialize({ bin: new Binary(Uint8Array.of(0x61)), hash: md5 });

    // promoteBuffers: true → 原生 Buffer，专用 subtype 丢失，一律 Buffer 文本
    const promoted = deserialize(raw, { promoteBuffers: true });
    expect(s.stringify(promoted.bin)).toBe(`Buffer("base64,YQ==")`);
    expect(s.stringify(promoted.hash)).toMatch(/^Buffer\(/);

    // promoteBuffers: false → 保住 Binary subtype
    const boxed = deserialize(raw, { promoteBuffers: false });
    expect(s.stringify(boxed.bin)).toBe(`Buffer("base64,YQ==")`);
    expect(s.stringify(boxed.hash)).toBe(`MD5("${md5Hex}")`);
  });

  test("parseAs Binary MD5", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    const hex = "00112233445566778899aabbccddeeff";
    const once = s.parseAs(Binary, `MD5("${hex}")`);
    expect(once).toBeInstanceOf(Binary);
    expect(once.sub_type).toBe(Binary.SUBTYPE_MD5);
  });

  test("Handling vs bson numeric", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    const long = Long.fromInt(1);
    // Handling 不认 bson 包装：默认也装箱；none 无法拆字面量
    expect(s.stringify(long)).toBe(`Int64("1")`);
    expect(s.stringify(new Int32(42))).toBe(`Int32("42")`);
    expect(s.stringify(new Double(1.5))).toBe(`Float64("1.5")`);
    expect(s.stringify(Decimal128.fromString("1.25"))).toBe(
      `Decimal128("1.25")`,
    );
    const none = createSerializer({ serializeNumberHandling: "none" });
    registerMongo(none.registry);
    expect(() => none.stringify(long)).toThrow(/none/);
    expect(() => none.stringify(new Int32(42))).toThrow(/none/);
    expect(() => none.stringify(new Double(1.5))).toThrow(/none/);
    expect(() => none.stringify(Decimal128.fromString("1.25"))).toThrow(
      /none/,
    );
    // none 只作用于数值路径，非数值 bson 类仍写 TypeName
    expect(none.stringify(new ObjectId(OID_HEX))).toBe(
      `ObjectId("${OID_HEX}")`,
    );

    // ser all：bson 数值类同样装箱（矩阵与 unsafe-only 同列）
    const all = createSerializer({ serializeNumberHandling: "all" });
    registerMongo(all.registry);
    expect(all.stringify(long)).toBe(`Int64("1")`);

    // 未 replace：de all 仍是核心包装
    const keep = createSerializer({ deserializeNumberHandling: "all" });
    registerMongo(keep.registry);
    expect(keep.parse(`Int64("1")`)).toBeInstanceOf(TASON.Types.Int64.ctor);
    expect(keep.parse(`Int64("1")`)).not.toBeInstanceOf(Long);
    expect(keep.parse(`Int32("42")`).constructor).toBe(TASON.Types.Int32.ctor);
    expect(keep.parse(`Decimal128("1.25")`).constructor).toBe(
      TASON.Types.Decimal128.ctor,
    );

    // replace 后 Handling 不再拆箱（all 也不拆）
    const replaced = createSerializer({
      deserializeNumberHandling: "native",
    });
    registerMongo(replaced.registry, {
      replaceDefaultImplementation: { Int64: true },
    });
    expect(replaced.parse(`Int64("1")`)).toBeInstanceOf(Long);

    const replacedAll = createSerializer({ deserializeNumberHandling: "all" });
    registerMongo(replacedAll.registry, {
      replaceDefaultImplementation: { Int64: true },
    });
    expect(replacedAll.parse(`Int64("1")`)).toBeInstanceOf(Long);
  });

  test("promoteValues / useBigInt64", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    const raw = serialize({
      i: new Int32(42),
      d: new Double(1.5),
      n: Long.fromInt(1),
      big: Long.fromString(UNSAFE_INT64),
    });

    const boxed = deserialize(raw, { promoteValues: false });
    expect(s.stringify(boxed.i)).toBe(`Int32("42")`);
    expect(s.stringify(boxed.d)).toBe(`Float64("1.5")`);
    expect(s.stringify(boxed.n)).toBe(`Int64("1")`);
    expect(s.stringify(boxed.big)).toBe(`Int64("${UNSAFE_INT64}")`);

    const asBig = deserialize(raw, { useBigInt64: true });
    expect(asBig.n).toBe(1n);
    expect(asBig.big).toBe(BigInt(UNSAFE_INT64));
    expect(s.stringify(asBig.n)).toBe("1");
    expect(s.stringify(asBig.big)).toBe(`BigInt("${UNSAFE_INT64}")`);
  });
});
