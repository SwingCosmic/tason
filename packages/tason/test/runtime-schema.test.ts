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
import { Decimal128 } from "@/types/numbers";

/**
 * schema / ClassMetadata（数值矩阵见 number-handling.test.ts）
 */

function createSerializer(
  options: ConstructorParameters<typeof TASON.Serializer>[0] = {},
) {
  return new TASON.Serializer({ indent: false, ...options });
}

class Node {
  id!: bigint;
  name!: string;
  tags!: string[];
  kids!: number[][];
  meta!: { label: string; score: bigint };

  constructor(init?: Partial<Node>) {
    if (init) Object.assign(this, init);
  }
}

const NodeSchema = v.object({
  id: v.bigint(),
  name: v.string(),
  tags: v.array(v.string()),
  kids: v.array(v.array(v.number())),
  meta: v.object({
    label: v.string(),
    score: v.bigint(),
  }),
});

function registerNode(
  s: InstanceType<typeof TASON.Serializer>,
  withAdapter = true,
  schema: unknown = NodeSchema,
) {
  if (withAdapter) {
    s.registry.setSchemaAdapter(createValibotAdapter());
  }
  s.registry.registerType("Node", { kind: "object", ctor: Node }, { schema });
}

class Bundle {
  bi!: bigint;
  num!: number;
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

function setupBundle(
  opts: ConstructorParameters<typeof TASON.Serializer>[0] = {},
) {
  const s = createSerializer(opts);
  s.registry.setSchemaAdapter(createValibotAdapter());
  s.registry.registerType(
    "Bundle",
    { kind: "object", ctor: Bundle },
    { schema: BundleSchema },
  );
  return s;
}

const fullBundleText = [
  "Bundle({",
  'bi:Int64("42"),',
  "num:7,",
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

describe("runtime schema", () => {
  describe("adapter", () => {
    test("default unregistered", () => {
      expect(createSerializer().registry.getSchemaAdapter()).toBeUndefined();
      expect(TASON.registry.getSchemaAdapter()).toBeUndefined();
    });

    test("valibot leaf and structure kinds", () => {
      // optional/nullable 解包到内层 RuntimeType
      const adapter = createValibotAdapter();
      const schema = v.object({
        a: v.bigint(),
        b: v.number(),
        c: v.string(),
        d: v.boolean(),
        e: v.array(v.number()),
        f: v.optional(v.bigint()),
        g: v.nullable(v.string()),
        nest: v.object({ x: v.number() }),
        re: v.instance(RegExp),
        when: v.date(),
      });
      expect(adapter.isSchema(schema)).toBe(true);
      expect(adapter.isSchema({ notASchema: true })).toBe(false);

      const entries = Object.fromEntries(adapter.objectEntries(schema)!);
      expect(adapter.runtimeType(entries.a)).toBe("bigint");
      expect(adapter.runtimeType(entries.b)).toBe("number");
      expect(adapter.runtimeType(entries.c)).toBe("string");
      expect(adapter.runtimeType(entries.d)).toBe("boolean");
      expect(adapter.runtimeType(entries.e)).toBe("array");
      expect(adapter.runtimeType(entries.f)).toBe("bigint");
      expect(adapter.runtimeType(entries.g)).toBe("string");
      expect(adapter.runtimeType(entries.nest)).toBe("object");
      expect(adapter.runtimeType(entries.re)).toBe("instance");
      expect(adapter.runtimeType(entries.when)).toBe("instance");
      expect(adapter.instanceCtor(entries.re)).toBe(RegExp);
      expect(adapter.instanceCtor(entries.when)).toBe(Date);
      expect(adapter.runtimeType(adapter.arrayElement(entries.e)!)).toBe(
        "number",
      );
      expect(
        adapter.runtimeType(
          Object.fromEntries(adapter.objectEntries(entries.nest)!).x,
        ),
      ).toBe("number");
    });

    test("nested array schema", () => {
      const adapter = createValibotAdapter();
      const matrix = v.array(v.array(v.number()));
      expect(adapter.runtimeType(matrix)).toBe("array");
      const row = adapter.arrayElement(matrix)!;
      expect(adapter.runtimeType(row)).toBe("array");
      expect(adapter.runtimeType(adapter.arrayElement(row)!)).toBe("number");
    });

    test("builtin instanceCtor and Registry ctor map", () => {
      const adapter = createValibotAdapter();
      const entries = Object.fromEntries(adapter.objectEntries(BundleSchema)!);
      expect(adapter.instanceCtor(entries.dec)).toBe(Decimal128);
      expect(adapter.instanceCtor(entries.buf)).toBe(TBuffer);
      expect(adapter.instanceCtor(entries.uuid)).toBe(UUID);
      expect(adapter.instanceCtor(entries.ts)).toBe(Timestamp);
      expect(adapter.instanceCtor(entries.day)).toBe(DateOnly);
      expect(adapter.instanceCtor(entries.clock)).toBe(TimeOnly);
      expect(adapter.instanceCtor(entries.json)).toBe(TJSON);

      const s = setupBundle();
      expect(s.registry.findTypeNameByCtor(Decimal128)).toBe("Decimal128");
      expect(s.registry.findTypeNameByCtor(TBuffer)).toBe("Buffer");
      expect(s.registry.findTypeNameByCtor(UUID)).toBe("UUID");
      expect(s.registry.findTypeNameByCtor(Date)).toBe("Date");
      expect(s.registry.findTypeNameByCtor(RegExp)).toBe("RegExp");
      expect(s.registry.findTypeNameByCtor(Timestamp)).toBe("Timestamp");
      expect(s.registry.findTypeNameByCtor(DateOnly)).toBe("DateOnly");
      expect(s.registry.findTypeNameByCtor(TimeOnly)).toBe("TimeOnly");
      expect(s.registry.findTypeNameByCtor(TJSON)).toBe("JSON");
    });
  });

  describe("ClassMetadata", () => {
    test("getClassMetadata", () => {
      const s = createSerializer();
      registerNode(s);
      const meta = s.registry.getClassMetadata("Node");
      expect(meta).toBeDefined();
      expect(meta!.schema).toBe(NodeSchema);
      expect((s.registry as any).getSchema).toBeUndefined();
      expect(s.registry.getClassMetadata("NoSuchType")).toBeUndefined();
    });

    test("unrecognized schema", () => {
      const s = createSerializer();
      s.registry.setSchemaAdapter(createValibotAdapter());
      s.registry.registerType(
        "Node",
        { kind: "object", ctor: Node },
        { schema: { notAValibotSchema: true } },
      );
      expect(() =>
        s.parse(
          `Node({id:Int64("1"),name:"a",tags:[],kids:[],meta:{label:"",score:0}})`,
        ),
      ).not.toThrow();
    });

    test("missing adapter or metadata", () => {
      const s1 = createSerializer();
      registerNode(s1, false);
      expect(s1.registry.getSchemaAdapter()).toBeUndefined();
      expect(
        s1.parse<Node>(
          `Node({id:Int64("1"),name:"a",tags:[],kids:[],meta:{label:"",score:0}})`,
        ).id,
      ).toBe(1n);

      const s2 = createSerializer();
      s2.registry.setSchemaAdapter(createValibotAdapter());
      s2.registry.registerType("Node", { kind: "object", ctor: Node });
      expect(
        s2.parse<Node>(
          `Node({id:Int64("1"),name:"a",tags:[],kids:[],meta:{label:"",score:0}})`,
        ).id,
      ).toBe(1n);
    });

    test("adapter replace and clear", () => {
      const s = createSerializer();
      registerNode(s);
      s.registry.setSchemaAdapter({
        isSchema: (_v): _v is unknown => false,
        objectEntries: () => null,
        arrayElement: () => null,
        runtimeType: () => "unknown",
        instanceCtor: () => null,
      });
      expect(
        s.parse(
          `Node({id:Int64("2"),name:"x",tags:[],kids:[],meta:{label:"",score:0}})`,
        ),
      ).toMatchObject({ id: 2n, name: "x" });

      s.registry.setSchemaAdapter(null);
      expect(s.registry.getSchemaAdapter()).toBeUndefined();
    });
  });

  describe("structure walk", () => {
    function setup() {
      const s = createSerializer();
      registerNode(s);
      return s;
    }

    test("arrays and nested object", () => {
      const s = setup();
      const n = s.parse<Node>(
        `Node({id:1,name:"n",tags:["a","b"],kids:[[1,2],[3.5]],meta:{label:"hi",score:Int64("9")}})`,
      );
      expect(n.tags).toEqual(["a", "b"]);
      expect(n.kids).toEqual([[1, 2], [3.5]]);
      expect(typeof n.kids[0][0]).toBe("number");
      expect(n.meta).toEqual({ label: "hi", score: 9n });
      expect(typeof n.meta.score).toBe("bigint");
    });

    test("bigint leaf and bigint array", () => {
      const s = setup();
      expect(
        s.parse<Node>(
          `Node({id:Int64("1"),name:"a",tags:[],kids:[],meta:{label:"",score:2}})`,
        ).id,
      ).toBe(1n);

      class Wrap {
        ids!: bigint[];
        constructor(init?: Partial<Wrap>) {
          if (init) Object.assign(this, init);
        }
      }
      s.registry.registerType(
        "Wrap",
        { kind: "object", ctor: Wrap },
        { schema: v.object({ ids: v.array(v.bigint()) }) },
      );
      const w = s.parse<Wrap>(`Wrap({ids:[Int64("1"),2]})`);
      expect(w.ids).toEqual([1n, 2n]);
      expect(s.parse<Wrap>(s.stringify(w)).ids).toEqual([1n, 2n]);
    });

    test("stringify structure", () => {
      const s = setup();
      const text = s.stringify(
        new Node({
          id: 1n,
          name: "a",
          tags: ["t"],
          kids: [[1, 2]],
          meta: { label: "L", score: 3n },
        }),
      );
      expect(text).toContain("tags:[");
      expect(text).toContain("kids:[[");
      expect(text).toContain("meta:{");
      const again = s.parse<Node>(text);
      expect(again.tags).toEqual(["t"]);
      expect(again.kids).toEqual([[1, 2]]);
      expect(again.meta.score).toBe(3n);
    });
  });

  describe("builtin instances", () => {
    test("parse entity", () => {
      const s = setupBundle();
      const b = s.parse<Bundle>(fullBundleText);

      expect(b).toBeInstanceOf(Bundle);
      expect(b.bi).toBe(42n);
      expect(b.num).toBe(7);
      // Decimal128 在 object-fallback-native 下拆到 Decimal
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
      expect(b.clock).toBeInstanceOf(TimeOnly);
      expect(b.json).toBeInstanceOf(TJSON);
      expect(b.json.toJSONValue()).toEqual({ k: 1 });
      expect(b.note).toBe("hello");
    });

    test("string literal fidelity", () => {
      // JSON 风格字符串不得冒充 Date / RegExp / Buffer / Decimal
      const s = setupBundle();
      const b = s.parse<Bundle>(
        [
          "Bundle({",
          "bi:1,num:2,",
          'dec:"3.14",buf:"base64,YQ==",',
          'uuid:"550e8400-e29b-41d4-a716-446655440000",',
          'when:"2023-01-15T00:00:00.000Z",re:"/foo/i",',
          'ts:"1700000000000",day:"2024-04-26",clock:"11:45:14.000",',
          'json:"{}",note:"1"',
          "})",
        ].join(""),
      );
      expect(b.bi).toBe(1n);
      expect(b.num).toBe(2);
      for (const key of [
        "dec",
        "buf",
        "uuid",
        "when",
        "re",
        "ts",
        "day",
        "clock",
        "json",
      ] as const) {
        expect(typeof b[key]).toBe("string");
      }
      expect(b.note).toBe("1");
      expect(b.when).not.toBeInstanceOf(Date);
      expect(b.re).not.toBeInstanceOf(RegExp);
      expect(b.dec).not.toBeInstanceOf(Decimal128);
    });

    test("stringify entity", () => {
      const s = setupBundle({
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
      for (const name of [
        "Decimal128",
        "Buffer",
        "UUID",
        "Date",
        "RegExp",
        "Timestamp",
        "DateOnly",
        "TimeOnly",
        "JSON",
      ]) {
        expect(text).toContain(`${name}(`);
      }
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

    test("standalone TypeInstance round-trip", () => {
      const s = createSerializer({
        serializeNumberHandling: "all",
        deserializeNumberHandling: "all",
      });
      const cases: [string, (v: unknown) => void][] = [
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
        ['DateOnly("2024-04-26")', (v) => expect(v).toBeInstanceOf(DateOnly)],
        ['TimeOnly("11:45:14.000")', (v) => expect(v).toBeInstanceOf(TimeOnly)],
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
        const out = s.stringify(parsed);
        expect(out.includes("(")).toBe(true);
        expect(() => s.parse(out)).not.toThrow();
      }
    });

    test("Dictionary", () => {
      const s = createSerializer({ useBuiltinDictionary: true });
      const m = s.parse(`Dictionary({pairs:[["k",1],["n",Int64("2")]]})`);
      expect(m).toBeInstanceOf(Map);
      expect((m as Map<string, unknown>).get("k")).toBe(1);
      expect((m as Map<string, unknown>).get("n")).toBe(2n);
      expect(s.stringify(new Map([["a", 1]])).startsWith("Dictionary(")).toBe(
        true,
      );
    });
  });
});
