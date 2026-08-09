import { describe, expect, test } from "@jest/globals";
import * as v from "valibot";
import Decimal from "decimal.js";
import TASON from "@/index";
import { createValibotAdapter } from "@/schema";
import {
  Decimal128,
  Float32,
  Float64,
  Int16,
  Int32,
  Int64,
  UInt8,
} from "@/types/numbers";

/**
 * 纯数值 Number Handling：
 * - 值级 ser/de × 内置数值 TypeName
 * - ObjectType 仅在需要 OT 上下文时用最简 schema
 */

class NumBox {
  bi!: bigint;
  n!: number;
  constructor(init?: Partial<NumBox>) {
    if (init) Object.assign(this, init);
  }
}
const NumBoxSchema = v.object({
  bi: v.bigint(),
  n: v.number(),
});

function ser(opts: ConstructorParameters<typeof TASON.Serializer>[0] = {}) {
  return new TASON.Serializer({ indent: false, ...opts });
}

function serWithNumBox(
  opts: ConstructorParameters<typeof TASON.Serializer>[0] = {},
) {
  const s = ser(opts);
  s.registry.setSchemaAdapter(createValibotAdapter());
  s.registry.registerType(
    "NumBox",
    { kind: "object", ctor: NumBox },
    { schema: NumBoxSchema },
  );
  return s;
}

describe("number handling", () => {
  describe("value-level deserialize", () => {
    test("default option", () => {
      expect(TASON.options.deserializeNumberHandling).toBe(
        "object-fallback-native",
      );
      expect(TASON.parse(`Int64("1")`)).toBe(1n);
    });

    test("native", () => {
      const s = ser({ deserializeNumberHandling: "native" });
      expect(s.parse(`UInt8("64")`)).toBe(64);
      expect(s.parse(`Int16("-171")`)).toBe(-171);
      expect(s.parse(`Int32("42798")`)).toBe(42798);
      expect(s.parse(`Int64("773738363261118345")`)).toBe(773738363261118345n);
      expect(s.parse(`Float32("1.5")`)).toBe(1.5);
      expect(s.parse(`Float64("2.5")`)).toBe(2.5);
      expect(s.parse(`Decimal128("3.14")`)).toEqual(new Decimal("3.14"));
      expect(s.parse(`BigInt("10")`)).toBe(10n);
      expect(s.parse(`Long("9")`)).toBe(9n);
      expect(s.parse(`Int("8")`)).toBe(8);
    });

    test("object-fallback-native (value-level)", () => {
      // 无 OT 上下文时与 native 同拆箱
      expect(TASON.parse(`UInt8("64")`)).toBe(64);
      expect(TASON.parse(`Int64("1")`)).toBe(1n);
      expect(TASON.parse(`Decimal128("3.14")`)).toEqual(new Decimal("3.14"));
      expect(TASON.parse(`[[Int64("1")]]`)).toEqual([[1n]]);
    });

    test("all", () => {
      // BigInt 标量本身不是包装类，仍为原生 bigint
      const s = ser({ deserializeNumberHandling: "all" });
      expect(s.parse(`UInt8("1")`)).toBeInstanceOf(UInt8);
      expect(s.parse(`Int16("1")`)).toBeInstanceOf(Int16);
      expect(s.parse(`Int32("1")`)).toBeInstanceOf(Int32);
      expect(s.parse(`Int64("1")`)).toBeInstanceOf(Int64);
      expect(s.parse(`Float32("1")`)).toBeInstanceOf(Float32);
      expect(s.parse(`Float64("1")`)).toBeInstanceOf(Float64);
      expect(s.parse(`Decimal128("1")`)).toBeInstanceOf(Decimal128);
      expect(s.parse(`BigInt("1")`)).toBe(1n);
    });

    test("object-fallback-all (value-level)", () => {
      // OT 外 ≈ native
      const s = ser({ deserializeNumberHandling: "object-fallback-all" });
      expect(s.parse(`Int64("2")`)).toBe(2n);
      expect(s.parse(`UInt8("3")`)).toBe(3);
    });
  });

  describe("value-level serialize", () => {
    test("default unsafe-only", () => {
      // 安全范围内裸字面量；超范围 / 超精度装箱
      expect(TASON.options.serializeNumberHandling).toBe("unsafe-only");
      expect(TASON.stringify(1n)).toBe("1");
      expect(TASON.stringify(BigInt(Number.MAX_SAFE_INTEGER))).toBe(
        String(Number.MAX_SAFE_INTEGER),
      );
      const justUnsafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      expect(TASON.stringify(justUnsafe)).toBe(`BigInt("${justUnsafe}")`);
      expect(TASON.stringify(2n ** 128n)).toBe(
        `BigInt("340282366920938463463374607431768211456")`,
      );

      expect(TASON.stringify(new Int32("1"))).toBe("1");
      expect(TASON.stringify(new UInt8("64"))).toBe("64");
      expect(TASON.stringify(new Int16("-171"))).toBe("-171");
      expect(TASON.stringify(new Int64("1"))).toBe("1");
      expect(TASON.stringify(new Float32("1.5"))).toBe("1.5");
      expect(TASON.stringify(new Float64("2.5"))).toBe("2.5");
      expect(TASON.stringify(new Decimal128("1.5"))).toBe("1.5");
      expect(
        TASON.stringify(new Decimal128("3.141592653589793238462643383279")),
      ).toBe(`Decimal128("3.141592653589793238462643383279")`);
      expect(TASON.stringify(new Int64("773738363261118345"))).toBe(
        `Int64("773738363261118345")`,
      );
    });

    test("none", () => {
      const s = ser({ serializeNumberHandling: "none" });
      expect(s.stringify(new Int32("1"))).toBe("1");
      expect(s.stringify(new Int64("1"))).toBe("1");
      const huge = 2n ** 128n;
      expect(s.stringify(huge)).toBe(
        "340282366920938463463374607431768211456",
      );
      expect(s.stringify(new Int64("773738363261118345"))).toBe(
        "773738363261118345",
      );
      expect(
        s.stringify(new Decimal128("3.141592653589793238462643383279")),
      ).toBe("3.141592653589793238462643383279");
    });

    test("all", () => {
      // 原生 number 仍裸写
      const s = ser({ serializeNumberHandling: "all" });
      expect(s.stringify(new Int32("1"))).toBe(`Int32("1")`);
      expect(s.stringify(new UInt8("1"))).toBe(`UInt8("1")`);
      expect(s.stringify(new Int64("1"))).toBe(`Int64("1")`);
      expect(s.stringify(1n)).toBe(`BigInt("1")`);
      expect(s.stringify(42)).toBe("42");
    });

    test("object-type-property (value-level)", () => {
      // OT 外 ≈ unsafe-only
      const s = ser({ serializeNumberHandling: "object-type-property" });
      expect(s.stringify(1n)).toBe("1");
      expect(s.stringify(2n ** 128n)).toBe(
        `BigInt("340282366920938463463374607431768211456")`,
      );
      expect(s.stringify(new Int32("7"))).toBe("7");
    });

    test("plain number under all modes", () => {
      for (const h of [
        "unsafe-only",
        "all",
        "none",
        "object-type-property",
      ] as const) {
        const s = ser({ serializeNumberHandling: h });
        expect(s.stringify(3.14)).toBe("3.14");
        expect(s.stringify(0)).toBe("0");
      }
    });
  });

  describe("value-level round-trip", () => {
    test("unsafe bigint", () => {
      const n = 1234567890123456789n;
      expect(TASON.stringify(n)).toBe(`BigInt("${n}")`);
      expect(TASON.parse(TASON.stringify(n))).toBe(n);
    });

    test("safe bigint under unsafe-only", () => {
      // stringify 成数字字面量后 parse 回 number
      expect(TASON.stringify(42n)).toBe("42");
      expect(TASON.parse(TASON.stringify(42n))).toBe(42);
    });

    test("Int32 wrapper under unsafe-only", () => {
      const text = TASON.stringify(new Int32("99"));
      expect(text).toBe("99");
      expect(TASON.parse(text)).toBe(99);
    });
  });

  describe("schema contract mapping", () => {
    test("bigint field", () => {
      const s = serWithNumBox();
      expect(s.parse<NumBox>(`NumBox({bi:Int64("1"),n:0})`).bi).toBe(1n);
      expect(s.parse<NumBox>(`NumBox({bi:BigInt("2"),n:0})`).bi).toBe(2n);
      expect(s.parse<NumBox>(`NumBox({bi:3,n:0})`).bi).toBe(3n);
      expect(s.parse<NumBox>(`NumBox({bi:Int32("4"),n:0})`).bi).toBe(4n);
    });

    test("number field", () => {
      const s = serWithNumBox();
      expect(s.parse<NumBox>(`NumBox({bi:0,n:Int32("18")})`).n).toBe(18);
      expect(s.parse<NumBox>(`NumBox({bi:0,n:Float64("6.5")})`).n).toBe(6.5);
      expect(s.parse<NumBox>(`NumBox({bi:0,n:7})`).n).toBe(7);
      expect(s.parse<NumBox>(`NumBox({bi:0,n:Int64("42")})`).n).toBe(42);
      expect(typeof s.parse<NumBox>(`NumBox({bi:0,n:Int64("42")})`).n).toBe(
        "number",
      );
    });

    test("number field unsafe Int64", () => {
      // 超安全整数不得静默截断
      const s = serWithNumBox();
      const unsafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      expect(() =>
        s.parse(`NumBox({bi:0,n:Int64("${unsafe}")})`),
      ).toThrow(/safe integer/i);
    });

    test("builtin number TypeNames under object-fallback-native", () => {
      class Wide {
        u8!: number;
        i16!: number;
        i32!: number;
        i64!: bigint;
        f32!: number;
        f64!: number;
        dec!: Decimal;
        bi!: bigint;
        constructor(init?: Partial<Wide>) {
          if (init) Object.assign(this, init);
        }
      }
      const s = ser();
      s.registry.setSchemaAdapter(createValibotAdapter());
      s.registry.registerType(
        "Wide",
        { kind: "object", ctor: Wide },
        {
          schema: v.object({
            u8: v.number(),
            i16: v.number(),
            i32: v.number(),
            i64: v.bigint(),
            f32: v.number(),
            f64: v.number(),
            dec: v.instance(Decimal128),
            bi: v.bigint(),
          }),
        },
      );
      const w = s.parse<Wide>(
        `Wide({u8:UInt8("1"),i16:Int16("2"),i32:Int32("3"),i64:Int64("4"),f32:Float32("1.5"),f64:Float64("2.5"),dec:Decimal128("3.14"),bi:BigInt("10")})`,
      );
      expect(w.u8).toBe(1);
      expect(w.i16).toBe(2);
      expect(w.i32).toBe(3);
      expect(w.i64).toBe(4n);
      expect(w.f32).toBe(1.5);
      expect(w.f64).toBe(2.5);
      expect(w.dec).toEqual(new Decimal("3.14"));
      expect(w.dec).not.toBeInstanceOf(Decimal128);
      expect(w.bi).toBe(10n);
      expect(w.u8).not.toBeInstanceOf(UInt8);
      expect(w.i64).not.toBeInstanceOf(Int64);
    });
  });

  describe("ObjectType handling modes", () => {
    test("object-fallback-native", () => {
      // 有契约 → RuntimeType；无 metadata → 值级拆箱
      const s = serWithNumBox();
      const box = s.parse<NumBox>(`NumBox({bi:Int64("1"),n:Int32("2")})`);
      expect(box.bi).toBe(1n);
      expect(box.n).toBe(2);
      expect(box.bi).not.toBeInstanceOf(Int64);

      const sNo = ser();
      sNo.registry.setSchemaAdapter(createValibotAdapter());
      sNo.registry.registerType("NumBox", { kind: "object", ctor: NumBox });
      const bare = sNo.parse<NumBox>(`NumBox({bi:Int64("1"),n:Int32("2")})`);
      expect(bare.bi).toBe(1n);
      expect(bare.n).toBe(2);
    });

    test("object-fallback-all", () => {
      // 有契约 → RuntimeType；无契约 OT 内保留包装
      const sWith = serWithNumBox({
        deserializeNumberHandling: "object-fallback-all",
      });
      const mapped = sWith.parse<NumBox>(
        `NumBox({bi:Int64("1"),n:Int32("2")})`,
      );
      expect(mapped.bi).toBe(1n);
      expect(mapped.n).toBe(2);
      expect(mapped.bi).not.toBeInstanceOf(Int64);

      const sNo = ser({ deserializeNumberHandling: "object-fallback-all" });
      sNo.registry.registerType("NumBox", { kind: "object", ctor: NumBox });
      const bare = sNo.parse<NumBox>(`NumBox({bi:Int64("1"),n:Int32("2")})`);
      expect(bare.bi).toBeInstanceOf(Int64);
      expect((bare.bi as unknown as Int64).value).toBe(1n);
      expect(bare.n).toBeInstanceOf(Int32);
    });

    test("native and all with metadata", () => {
      // native / all 均忽略 schema 契约
      const sNative = serWithNumBox({ deserializeNumberHandling: "native" });
      const a = sNative.parse<NumBox>(`NumBox({bi:Int64("1"),n:Int32("2")})`);
      expect(a.bi).toBe(1n);
      expect(a.n).toBe(2);

      const sAll = serWithNumBox({ deserializeNumberHandling: "all" });
      const b = sAll.parse<NumBox>(`NumBox({bi:Int64("1"),n:Int32("2")})`);
      expect(b.bi).toBeInstanceOf(Int64);
      expect(b.n).toBeInstanceOf(Int32);
    });

    test("serialize modes on ObjectType", () => {
      // object-type-property：OT 内 ≈ all，顶层 ≈ unsafe-only
      const leaf = new NumBox({ bi: 1n, n: 2 });
      const huge = new NumBox({
        bi: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        n: 2,
      });

      expect(serWithNumBox().stringify(leaf)).toBe(`NumBox({bi:1,n:2})`);
      expect(serWithNumBox().stringify(huge)).toBe(
        `NumBox({bi:BigInt("${huge.bi}"),n:2})`,
      );

      expect(
        serWithNumBox({ serializeNumberHandling: "all" }).stringify(leaf),
      ).toBe(`NumBox({bi:BigInt("1"),n:2})`);

      expect(
        serWithNumBox({ serializeNumberHandling: "none" }).stringify(huge),
      ).toBe(`NumBox({bi:${huge.bi},n:2})`);

      const otp = serWithNumBox({
        serializeNumberHandling: "object-type-property",
      });
      expect(otp.stringify(leaf)).toBe(`NumBox({bi:BigInt("1"),n:2})`);
      expect(otp.stringify(1n)).toBe("1");
      expect(otp.stringify(huge.bi)).toBe(`BigInt("${huge.bi}")`);
    });
  });
});
