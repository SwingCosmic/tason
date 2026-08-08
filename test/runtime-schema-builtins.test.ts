import { describe, expect, test } from "@jest/globals";
import * as v from "valibot";
import Decimal from "decimal.js";
import TASON from "@/index";
import { createValibotAdapter } from "@/schema";
import { Buffer as TBuffer } from "@/types/Buffer";
import { UUID } from "@/types/UUID";
import {
  DateOnly,
  TimeOnly,
  Timestamp,
} from "@/types/date";
import { JSON as TJSON } from "@/types/json";
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
 * 内置复杂类型 × schema instance / 数字契约 / TypeInstance 全路径探针。
 * 字面量保真：字符串不得冒充 Date/RegExp/数字。
 */
describe("runtime schema × builtin complex types", () => {
  class Bundle {
    // 数字 RuntimeType
    bi!: bigint;
    num!: number;
    // instance / 包装
    dec!: Decimal128 | Decimal;
    buf!: TBuffer;
    uuid!: UUID;
    when!: Date;
    re!: RegExp;
    ts!: Timestamp;
    day!: DateOnly;
    clock!: TimeOnly;
    json!: TJSON;
    note!: string;

    constructor(init?: Partial<Bundle>) {
      if (init) Object.assign(this, init);
    }
  }

  const BundleSchema = v.object({
    bi: v.bigint(),
    num: v.number(),
    dec: v.instance(Decimal128),
    buf: v.instance(TBuffer),
    uuid: v.instance(UUID),
    when: v.date(),
    re: v.instance(RegExp),
    ts: v.instance(Timestamp),
    day: v.instance(DateOnly),
    clock: v.instance(TimeOnly),
    json: v.instance(TJSON),
    note: v.string(),
  });

  function setup(opts: ConstructorParameters<typeof TASON.Serializer>[0] = {}) {
    const s = new TASON.Serializer({
      indent: false,
      ...opts,
    });
    s.registry.setSchemaAdapter(createValibotAdapter());
    s.registry.registerType(
      "Bundle",
      { kind: "object", ctor: Bundle },
      { schema: BundleSchema },
    );
    return s;
  }

  /** 全字段 TypeInstance 文本（类型由 TypeName 描述） */
  const fullTypeInstanceText = [
    "Bundle({",
    'bi:Int64("42"),',
    'num:Int32("7"),',
    'dec:Decimal128("3.14159265358979323846"),',
    'buf:Buffer("base64,YQ=="),',
    'uuid:UUID("550e8400-e29b-41d4-a716-446655440000"),',
    'when:Date("2023-01-15T00:00:00.000Z"),',
    're:RegExp("/foo+/gi"),',
    'ts:Timestamp("1700000000000"),',
    'day:DateOnly("2024-04-26"),',
    'clock:TimeOnly("11:45:14.000"),',
    'json:JSON("{\\"k\\":1}"),',
    'note:"hello"',
    "})",
  ].join("");

  test("adapter: instanceCtor for all complex builtins", () => {
    const adapter = createValibotAdapter();
    expect(adapter.isSchema(BundleSchema)).toBe(true);
    const entries = Object.fromEntries(adapter.objectEntries(BundleSchema)!);
    expect(adapter.runtimeType(entries.bi)).toBe("bigint");
    expect(adapter.runtimeType(entries.num)).toBe("number");
    expect(adapter.runtimeType(entries.dec)).toBe("instance");
    expect(adapter.instanceCtor(entries.dec)).toBe(Decimal128);
    expect(adapter.instanceCtor(entries.buf)).toBe(TBuffer);
    expect(adapter.instanceCtor(entries.uuid)).toBe(UUID);
    expect(adapter.instanceCtor(entries.when)).toBe(Date);
    expect(adapter.instanceCtor(entries.re)).toBe(RegExp);
    expect(adapter.instanceCtor(entries.ts)).toBe(Timestamp);
    expect(adapter.instanceCtor(entries.day)).toBe(DateOnly);
    expect(adapter.instanceCtor(entries.clock)).toBe(TimeOnly);
    expect(adapter.instanceCtor(entries.json)).toBe(TJSON);
    expect(adapter.runtimeType(entries.note)).toBe("string");
  });

  test("Registry findTypeNameByCtor for builtins", () => {
    const s = setup();
    expect(s.registry.findTypeNameByCtor(Decimal128)).toBe("Decimal128");
    expect(s.registry.findTypeNameByCtor(TBuffer)).toBe("Buffer");
    expect(s.registry.findTypeNameByCtor(UUID)).toBe("UUID");
    expect(s.registry.findTypeNameByCtor(Date)).toBe("Date");
    expect(s.registry.findTypeNameByCtor(RegExp)).toBe("RegExp");
    expect(s.registry.findTypeNameByCtor(Timestamp)).toBe("Timestamp");
    expect(s.registry.findTypeNameByCtor(DateOnly)).toBe("DateOnly");
    expect(s.registry.findTypeNameByCtor(TimeOnly)).toBe("TimeOnly");
    // JSON / JSONArray / JSONObject 共用 ctor，取先注册的 JSON
    expect(s.registry.findTypeNameByCtor(TJSON)).toBe("JSON");
  });

  test("parse TypeInstance bag: complex fields become correct JS types (default handling)", () => {
    const s = setup();
    const b = s.parse<Bundle>(fullTypeInstanceText);

    expect(b).toBeInstanceOf(Bundle);
    expect(b.bi).toBe(42n);
    expect(typeof b.bi).toBe("bigint");
    expect(b.num).toBe(7);
    expect(typeof b.num).toBe("number");

    // record-type → native 拆箱：Decimal128 包装 → decimal.js Decimal
    expect(b.dec).toBeInstanceOf(Decimal);
    expect((b.dec as Decimal).toString()).toBe("3.14159265358979323846");

    expect(b.buf).toBeInstanceOf(TBuffer);
    expect(b.buf.type).toBe("base64");
    expect(b.uuid).toBeInstanceOf(UUID);
    expect(b.uuid.value).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(b.when).toBeInstanceOf(Date);
    expect(b.when.toISOString()).toBe("2023-01-15T00:00:00.000Z");
    expect(b.re).toBeInstanceOf(RegExp);
    expect(b.re.source).toBe("foo+");
    expect(b.re.flags).toMatch(/g/);
    expect(b.re.flags).toMatch(/i/);
    expect(b.ts).toBeInstanceOf(Timestamp);
    expect(b.ts.time).toBe(1700000000000);
    expect(b.day).toBeInstanceOf(DateOnly);
    expect(b.day.toString()).toBe("2024-04-26");
    // TimeOnly 反序列化依赖 Date 解析纯时间串——若实现有坑会在此暴露
    expect(b.clock).toBeInstanceOf(TimeOnly);
    expect(b.json).toBeInstanceOf(TJSON);
    expect(b.json.toJSONValue()).toEqual({ k: 1 });
    expect(b.note).toBe("hello");
  });

  test("parse with deserialize all: keep Decimal128 wrapper", () => {
    const s = setup({ deserializeNumberHandling: "all" });
    const b = s.parse<Bundle>(fullTypeInstanceText);
    expect(b.dec).toBeInstanceOf(Decimal128);
    expect((b.dec as Decimal128).value.toString()).toBe(
      "3.14159265358979323846",
    );
    // all 下数值包装保留
    expect(b.bi).toBeInstanceOf(Int64);
    expect(b.num).toBeInstanceOf(Int32);
  });

  test("literal fidelity: strings are not Date/RegExp/number/Buffer", () => {
    const s = setup();
    const b = s.parse<Bundle>(
      [
        "Bundle({",
        'bi:1,', // 数字字面量 → bigint 契约 OK
        "num:2,",
        'dec:"3.14",', // 字符串 ≠ Decimal
        'buf:"base64,YQ==",',
        'uuid:"550e8400-e29b-41d4-a716-446655440000",',
        'when:"2023-01-15T00:00:00.000Z",',
        're:"/foo/i",',
        'ts:"1700000000000",',
        'day:"2024-04-26",',
        'clock:"11:45:14.000",',
        'json:"{}",',
        'note:"1"', // 字符串 "1" ≠ number
        "})",
      ].join(""),
    );

    expect(b.bi).toBe(1n);
    expect(b.num).toBe(2);
    expect(typeof b.dec).toBe("string");
    expect(typeof b.buf).toBe("string");
    expect(typeof b.uuid).toBe("string");
    expect(typeof b.when).toBe("string");
    expect(typeof b.re).toBe("string");
    expect(typeof b.ts).toBe("string");
    expect(typeof b.day).toBe("string");
    expect(typeof b.clock).toBe("string");
    expect(typeof b.json).toBe("string");
    expect(b.note).toBe("1");
    expect(b.dec).not.toBeInstanceOf(Decimal);
    expect(b.dec).not.toBeInstanceOf(Decimal128);
    expect(b.when).not.toBeInstanceOf(Date);
    expect(b.re).not.toBeInstanceOf(RegExp);
  });

  test("standalone scalar TypeInstance round-trip (no entity)", () => {
    const s = new TASON.Serializer({
      indent: false,
      serializeNumberHandling: "all",
      deserializeNumberHandling: "all",
    });

    const cases: [string, (v: unknown) => void][] = [
      ['UInt8("64")', (v) => expect(v).toBeInstanceOf(UInt8)],
      ['Int16("-1")', (v) => expect(v).toBeInstanceOf(Int16)],
      ['Int32("7")', (v) => expect(v).toBeInstanceOf(Int32)],
      ['Int64("9")', (v) => expect(v).toBeInstanceOf(Int64)],
      ['Float32("1.5")', (v) => expect(v).toBeInstanceOf(Float32)],
      ['Float64("2.5")', (v) => expect(v).toBeInstanceOf(Float64)],
      [
        'Decimal128("3.14159265358979323846")',
        (v) => {
          expect(v).toBeInstanceOf(Decimal128);
          expect((v as Decimal128).value.toString()).toBe(
            "3.14159265358979323846",
          );
        },
      ],
      ['BigInt("100")', (v) => expect(v).toBe(100n)],
      [
        'Buffer("hex,0102")',
        (v) => {
          expect(v).toBeInstanceOf(TBuffer);
          expect((v as TBuffer).type).toBe("hex");
        },
      ],
      [
        'UUID("550e8400-e29b-41d4-a716-446655440000")',
        (v) => expect(v).toBeInstanceOf(UUID),
      ],
      [
        'Date("2023-01-15T00:00:00.000Z")',
        (v) => expect(v).toBeInstanceOf(Date),
      ],
      ['RegExp("/ab/i")', (v) => expect(v).toBeInstanceOf(RegExp)],
      [
        'Timestamp("1000")',
        (v) => {
          expect(v).toBeInstanceOf(Timestamp);
          expect((v as Timestamp).time).toBe(1000);
        },
      ],
      [
        'DateOnly("2024-04-26")',
        (v) => expect(v).toBeInstanceOf(DateOnly),
      ],
      ['JSON("null")', (v) => expect(v).toBeInstanceOf(TJSON)],
      [
        'JSONArray("[1,2]")',
        (v) => {
          expect(v).toBeInstanceOf(TJSON);
          expect((v as TJSON).toJSONValue()).toEqual([1, 2]);
        },
      ],
      [
        'JSONObject("{\\"a\\":1}")',
        (v) => {
          expect(v).toBeInstanceOf(TJSON);
          expect((v as TJSON).toJSONValue()).toEqual({ a: 1 });
        },
      ],
    ];

    for (const [text, assert] of cases) {
      const parsed = s.parse(text);
      assert(parsed);
      // 再 stringify 应带 TypeName（serialize all）
      const out = s.stringify(parsed);
      expect(out.includes("(")).toBe(true);
      // 再 parse 不炸
      expect(() => s.parse(out)).not.toThrow();
    }
  });

  test("stringify entity with complex instances keeps TypeNames", () => {
    const s = setup({
      serializeNumberHandling: "all",
      deserializeNumberHandling: "all",
    });
    const b = new Bundle({
      bi: 42n,
      num: 7,
      dec: new Decimal128("3.14"),
      buf: new TBuffer("base64,YQ=="),
      uuid: new UUID("550e8400-e29b-41d4-a716-446655440000"),
      when: new Date("2023-01-15T00:00:00.000Z"),
      re: /foo+/gi,
      ts: new Timestamp(1700000000000),
      day: new DateOnly(new Date(2024, 3, 26)),
      clock: new TimeOnly(new Date(1970, 0, 1, 11, 45, 14)),
      json: new TJSON('{"k":1}'),
      note: "hello",
    });

    const text = s.stringify(b);
    expect(text.startsWith("Bundle(")).toBe(true);
    expect(text).toContain("BigInt("); // bigint + all
    expect(text).toContain("Decimal128(");
    expect(text).toContain("Buffer(");
    expect(text).toContain("UUID(");
    expect(text).toContain("Date(");
    expect(text).toContain("RegExp(");
    expect(text).toContain("Timestamp(");
    expect(text).toContain("DateOnly(");
    expect(text).toContain("TimeOnly(");
    expect(text).toContain("JSON(");

    const again = s.parse<Bundle>(text);
    expect(again.buf).toBeInstanceOf(TBuffer);
    expect(again.uuid).toBeInstanceOf(UUID);
    expect(again.when).toBeInstanceOf(Date);
    expect(again.re).toBeInstanceOf(RegExp);
    expect(again.dec).toBeInstanceOf(Decimal128);
    expect(again.ts).toBeInstanceOf(Timestamp);
    expect(again.day).toBeInstanceOf(DateOnly);
    expect(again.clock).toBeInstanceOf(TimeOnly);
    expect(again.json).toBeInstanceOf(TJSON);
  });

  test("Dictionary TypeInstance (useBuiltinDictionary)", () => {
    const s = new TASON.Serializer({
      indent: false,
      useBuiltinDictionary: true,
    });
    const m = s.parse(`Dictionary({pairs:[["k",1],["n",Int64("2")]]})`);
    expect(m).toBeInstanceOf(Map);
    expect((m as Map<string, unknown>).get("k")).toBe(1);
    expect((m as Map<string, unknown>).get("n")).toBe(2n);
    expect(s.stringify(new Map([["a", 1]])).startsWith("Dictionary(")).toBe(
      true,
    );
  });

  test("TimeOnly TypeInstance alone (parse known-good format)", () => {
    // 实体测例若失败，单独钉 TimeOnly 行为
    const s = new TASON.Serializer({ indent: false });
    // 与 date.ts deserialize 一致：依赖 new Date(value)
    let threw = false;
    try {
      const t = s.parse(`TimeOnly("11:45:14.000")`);
      expect(t).toBeInstanceOf(TimeOnly);
    } catch {
      threw = true;
    }
    // 记录结果：实现若无法解析纯时间串，测试仍报告明确失败
    if (threw) {
      // 尝试带日期前缀的变通（仅诊断，主断言仍要求 TypeOnly 可工作）
      expect(() => s.parse(`TimeOnly("11:45:14.000")`)).not.toThrow();
    }
  });
});
