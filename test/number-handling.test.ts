import { describe, expect, test } from "@jest/globals";
import Decimal from "decimal.js";
import TASON from "@/index";
import {
  Decimal128,
  Float32,
  Float64,
  Int16,
  Int32,
  Int64,
  UInt8,
} from "@/types/numbers";

describe("number handling (phase 1)", () => {
  describe("deserialize defaults and unboxing", () => {
    test("N1: default record-type degrades to unbox Int64 → bigint", () => {
      expect(TASON.parse(`Int64("1")`)).toBe(1n);
      expect(TASON.options.deserializeNumberHandling).toBe("record-type");
    });

    test("N2: deserialize all keeps Int64 wrapper", () => {
      const s = new TASON.Serializer({ deserializeNumberHandling: "all" });
      const v = s.parse(`Int64("1")`);
      expect(v).toBeInstanceOf(Int64);
      expect((v as Int64).value).toBe(1n);
    });

    test("N3: deserialize native unboxes Int32 → number", () => {
      const s = new TASON.Serializer({
        deserializeNumberHandling: "native",
      });
      expect(s.parse(`Int32("1")`)).toBe(1);
      expect(typeof s.parse(`Int32("1")`)).toBe("number");
    });

    test("N7: nested array unboxes under default deserialize", () => {
      expect(TASON.parse(`[[Int64("1")]]`)).toEqual([[1n]]);
    });

    test("N8: object-type-property degrades to native unbox (phase 1)", () => {
      const s = new TASON.Serializer({
        deserializeNumberHandling: "object-type-property",
      });
      expect(s.parse(`Int64("2")`)).toBe(2n);
      expect(s.parse(`UInt8("3")`)).toBe(3);
    });

    test("unbox all builtin number scalars under default", () => {
      expect(TASON.parse(`UInt8("64")`)).toBe(64);
      expect(TASON.parse(`Int16("-171")`)).toBe(-171);
      expect(TASON.parse(`Int32("42798")`)).toBe(42798);
      expect(TASON.parse(`Int64("773738363261118345")`)).toBe(
        773738363261118345n,
      );
      expect(TASON.parse(`Float32("1.5")`)).toBe(1.5);
      expect(TASON.parse(`Float64("2.5")`)).toBe(2.5);
      expect(TASON.parse(`Decimal128("3.14")`)).toEqual(new Decimal("3.14"));
      expect(TASON.parse(`BigInt("10")`)).toBe(10n);
      // aliases
      expect(TASON.parse(`Long("9")`)).toBe(9n);
      expect(TASON.parse(`Int("8")`)).toBe(8);
    });

    test("deserialize all keeps all wrappers", () => {
      const s = new TASON.Serializer({ deserializeNumberHandling: "all" });
      expect(s.parse(`UInt8("1")`)).toBeInstanceOf(UInt8);
      expect(s.parse(`Int16("1")`)).toBeInstanceOf(Int16);
      expect(s.parse(`Int32("1")`)).toBeInstanceOf(Int32);
      expect(s.parse(`Int64("1")`)).toBeInstanceOf(Int64);
      expect(s.parse(`Float32("1")`)).toBeInstanceOf(Float32);
      expect(s.parse(`Float64("1")`)).toBeInstanceOf(Float64);
      expect(s.parse(`Decimal128("1")`)).toBeInstanceOf(Decimal128);
      expect(s.parse(`BigInt("1")`)).toBe(1n);
    });

  });

  describe("serialize", () => {
    test("N4: unsafe-only serializes safe bigint as number literal", () => {
      expect(TASON.options.serializeNumberHandling).toBe("unsafe-only");
      expect(TASON.stringify(1n)).toBe("1");
      expect(TASON.stringify(BigInt(Number.MAX_SAFE_INTEGER))).toBe(
        String(Number.MAX_SAFE_INTEGER),
      );
      expect(TASON.stringify(BigInt(Number.MIN_SAFE_INTEGER))).toBe(
        String(Number.MIN_SAFE_INTEGER),
      );
      // 超出安全范围才装箱
      const justUnsafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      expect(TASON.stringify(justUnsafe)).toBe(`BigInt("${justUnsafe}")`);
      expect(TASON.stringify(2n ** 128n)).toBe(
        `BigInt("340282366920938463463374607431768211456")`,
      );
    });

    test("N5: serialize none forces bare literals for all numeric types", () => {
      const s = new TASON.Serializer({ serializeNumberHandling: "none" });
      // 小整数包装
      expect(s.stringify(new Int32("1"))).toBe("1");
      expect(s.stringify(new UInt8("64"))).toBe("64");
      expect(s.stringify(new Int64("1"))).toBe("1");
      // 超大 bigint / Int64：仍为裸十进制字面量，不写 TypeName
      const huge = 2n ** 128n;
      expect(s.stringify(huge)).toBe(
        "340282366920938463463374607431768211456",
      );
      expect(s.stringify(new Int64("773738363261118345"))).toBe(
        "773738363261118345",
      );
      // 超精度 Decimal128
      expect(
        s.stringify(
          new Decimal128("3.141592653589793238462643383279"),
        ),
      ).toBe("3.141592653589793238462643383279");
      expect(s.stringify(new Decimal128("3.14"))).toBe("3.14");
      // 原生 safe bigint
      expect(s.stringify(1n)).toBe("1");
    });

    test("unsafe-only: wrappers become number when safe", () => {
      expect(TASON.stringify(new Int32("1"))).toBe("1");
      expect(TASON.stringify(new UInt8("64"))).toBe("64");
      expect(TASON.stringify(new Int16("-171"))).toBe("-171");
      expect(TASON.stringify(new Int64("1"))).toBe("1");
      expect(TASON.stringify(new Float32("1.5"))).toBe("1.5");
      expect(TASON.stringify(new Float64("2.5"))).toBe("2.5");
      // 可无损表示为 number 的 Decimal
      expect(TASON.stringify(new Decimal128("1.5"))).toBe("1.5");
      // 超精度 Decimal 仍装箱
      expect(
        TASON.stringify(
          new Decimal128("3.141592653589793238462643383279"),
        ),
      ).toBe(`Decimal128("3.141592653589793238462643383279")`);
      // 超出 safe integer 的 Int64 仍装箱
      expect(
        TASON.stringify(new Int64("773738363261118345")),
      ).toBe(`Int64("773738363261118345")`);
    });

    test("N8: serialize object-type-property degrades to unsafe-only (phase 1)", () => {
      const s = new TASON.Serializer({
        serializeNumberHandling: "object-type-property",
      });
      expect(s.stringify(1n)).toBe("1");
      expect(s.stringify(2n ** 128n)).toBe(
        `BigInt("340282366920938463463374607431768211456")`,
      );
      expect(s.stringify(new Int32("7"))).toBe("7");
    });

    test("serialize all keeps TypeName for wrappers and bigint", () => {
      const s = new TASON.Serializer({ serializeNumberHandling: "all" });
      expect(s.stringify(new Int32("1"))).toBe(`Int32("1")`);
      expect(s.stringify(1n)).toBe(`BigInt("1")`);
      expect(s.stringify(42)).toBe("42");
    });

    test("plain number always bare regardless of handling", () => {
      for (const h of [
        "unsafe-only",
        "all",
        "none",
        "object-type-property",
      ] as const) {
        const s = new TASON.Serializer({ serializeNumberHandling: h });
        expect(s.stringify(3.14)).toBe("3.14");
        expect(s.stringify(0)).toBe("0");
      }
    });
  });

  describe("round-trip under default options", () => {
    test("unsafe bigint round-trip keeps bigint", () => {
      const n = 1234567890123456789n;
      expect(TASON.stringify(n)).toBe(`BigInt("${n}")`);
      expect(TASON.parse(TASON.stringify(n))).toBe(n);
    });

    test("safe bigint becomes number after round-trip under unsafe-only", () => {
      expect(TASON.stringify(42n)).toBe("42");
      expect(TASON.parse(TASON.stringify(42n))).toBe(42);
    });

    test("Int32 wrapper serializes as number under unsafe-only", () => {
      const text = TASON.stringify(new Int32("99"));
      expect(text).toBe("99");
      expect(TASON.parse(text)).toBe(99);
    });
  });
});
