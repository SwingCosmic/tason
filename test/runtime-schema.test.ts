import { describe, expect, it, test } from "@jest/globals";
import * as v from "valibot";
import TASON from "@/index";
import { createValibotAdapter } from "@/schema";
import { Int64, Int32 } from "@/types/numbers";

/** 阶段 2.2 解锁开关；2.1 期间 S10–S17 使用 skip */
const PHASE_2_2 = false;
const it22 = PHASE_2_2 ? it : it.skip;

class User {
  id!: bigint;
  name!: string;
  age!: number;

  constructor(init?: Partial<User>) {
    if (init) Object.assign(this, init);
  }
}

const UserSchema = v.object({
  id: v.bigint(),
  name: v.string(),
  age: v.number(),
});

function createSerializer(options: ConstructorParameters<typeof TASON.Serializer>[0] = {}) {
  const s = new TASON.Serializer({ indent: false, ...options });
  return s;
}

function registerUserWithSchema(
  s: InstanceType<typeof TASON.Serializer>,
  withAdapter = true,
) {
  if (withAdapter) {
    s.registry.setSchemaAdapter(createValibotAdapter());
  }
  s.registry.registerType(
    "User",
    { kind: "object", ctor: User },
    { schema: UserSchema },
  );
}

describe("runtime schema (phase 2)", () => {
  describe("2.1 — leaf contract (real assertions)", () => {
    test("S1: adapter + metadata id:bigint, parse Int64 → 1n", () => {
      const s = createSerializer();
      registerUserWithSchema(s);
      const u = s.parse<User>(`User({id:Int64("1"),name:"a",age:18})`);
      expect(u).toBeInstanceOf(User);
      expect(u.id).toBe(1n);
      expect(typeof u.id).toBe("bigint");
      expect(u.name).toBe("a");
      expect(u.age).toBe(18);
    });

    test("S2: age:number, parse Int32 → number 18", () => {
      const s = createSerializer();
      registerUserWithSchema(s);
      const u = s.parse<User>(`User({id:Int64("1"),name:"a",age:Int32("18")})`);
      expect(u.age).toBe(18);
      expect(typeof u.age).toBe("number");
      expect(u.age).not.toBeInstanceOf(Int32);
    });

    test("S3: ObjectType without metadata — phase 1 behavior", () => {
      const s = createSerializer();
      s.registry.setSchemaAdapter(createValibotAdapter());
      s.registry.registerType("User", { kind: "object", ctor: User });
      // 无 metadata：Int64 仍按 record-type→native 拆箱为 bigint
      const u = s.parse<User>(`User({id:Int64("1"),name:"a",age:18})`);
      expect(u.id).toBe(1n);
      expect(u.age).toBe(18);
    });

    test("S4: stringify User with metadata follows serialize Handling", () => {
      const s = createSerializer({ serializeNumberHandling: "unsafe-only" });
      registerUserWithSchema(s);
      const user = new User({ id: 1n, name: "a", age: 18 });
      // unsafe-only：安全 bigint 裸写，number 裸写
      expect(s.stringify(user)).toBe(`User({id:1,name:"a",age:18})`);

      const sAll = createSerializer({ serializeNumberHandling: "all" });
      registerUserWithSchema(sAll);
      // bigint 契约 + all → BigInt TypeName；number 仍裸字面量
      expect(sAll.stringify(user)).toBe(`User({id:BigInt("1"),name:"a",age:18})`);

      const unsafe = new User({
        id: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        name: "b",
        age: 20,
      });
      expect(s.stringify(unsafe)).toBe(
        `User({id:BigInt("${BigInt(Number.MAX_SAFE_INTEGER) + 1n}"),name:"b",age:20})`,
      );
    });

    test("S5: unrecognized schema is ignored, no throw", () => {
      const s = createSerializer();
      s.registry.setSchemaAdapter(createValibotAdapter());
      s.registry.registerType(
        "User",
        { kind: "object", ctor: User },
        { schema: { notAValibotSchema: true } },
      );
      // adapter.isSchema 对无 type 的对象为 false → 忽略契约
      expect(() =>
        s.parse(`User({id:Int64("1"),name:"a",age:18})`),
      ).not.toThrow();
      const u = s.parse<User>(`User({id:Int64("1"),name:"a",age:18})`);
      expect(u.id).toBe(1n);
    });

    test("S6: native + metadata ignores contract, full unbox", () => {
      const s = createSerializer({ deserializeNumberHandling: "native" });
      registerUserWithSchema(s);
      const u = s.parse<User>(`User({id:Int64("1"),name:"a",age:Int32("18")})`);
      expect(u.id).toBe(1n);
      expect(u.age).toBe(18);
      // 与无契约 native 一致：不保留包装
      expect(u.id).not.toBeInstanceOf(Int64);
      expect(u.age).not.toBeInstanceOf(Int32);
    });

    test("S7: no adapter, has schema — phase 1 behavior", () => {
      const s = createSerializer();
      // 故意不 setSchemaAdapter
      s.registry.registerType(
        "User",
        { kind: "object", ctor: User },
        { schema: UserSchema },
      );
      expect(s.registry.getSchemaAdapter()).toBeUndefined();
      const u = s.parse<User>(`User({id:Int64("1"),name:"a",age:18})`);
      expect(u.id).toBe(1n);
      expect(u.age).toBe(18);
    });

    test("S8: set replaces / null clears adapter", () => {
      const s = createSerializer();
      registerUserWithSchema(s);
      expect(s.registry.getSchemaAdapter()).toBeDefined();

      // 替换为无法识别任何 schema 的 adapter
      s.registry.setSchemaAdapter({
        isSchema: (_v): _v is unknown => false,
        objectEntries: () => null,
        arrayElement: () => null,
        runtimeType: () => "unknown",
        instanceCtor: () => null,
      });
      // isSchema 恒 false → 忽略契约，仍可 parse
      expect(s.parse(`User({id:Int64("2"),name:"x",age:1})`)).toMatchObject({
        id: 2n,
        name: "x",
        age: 1,
      });

      s.registry.setSchemaAdapter(null);
      expect(s.registry.getSchemaAdapter()).toBeUndefined();
      const u = s.parse<User>(`User({id:Int64("3"),name:"y",age:2})`);
      expect(u.id).toBe(3n);
    });

    test("S9: getClassMetadata readable; no public getSchema", () => {
      const s = createSerializer();
      registerUserWithSchema(s);
      const meta = s.registry.getClassMetadata("User");
      expect(meta).toBeDefined();
      expect(meta!.schema).toBe(UserSchema);
      // 无 getSchema API
      expect((s.registry as any).getSchema).toBeUndefined();
      expect(s.registry.getClassMetadata("NoSuchType")).toBeUndefined();
    });

    test("default registry has no schema adapter", () => {
      const s = createSerializer();
      expect(s.registry.getSchemaAdapter()).toBeUndefined();
      expect(TASON.registry.getSchemaAdapter()).toBeUndefined();
    });

    test("createValibotAdapter maps leaf kinds", () => {
      const adapter = createValibotAdapter();
      const schema = v.object({
        a: v.bigint(),
        b: v.number(),
        c: v.string(),
        d: v.boolean(),
        e: v.array(v.number()),
        f: v.optional(v.bigint()),
        re: v.instance(RegExp),
        when: v.date(),
      });
      expect(adapter.isSchema(schema)).toBe(true);
      const entries = [...adapter.objectEntries(schema)!];
      const kinds = Object.fromEntries(
        entries.map(([k, s]) => [k, adapter.runtimeType(s)]),
      );
      expect(kinds).toEqual({
        a: "bigint",
        b: "number",
        c: "string",
        d: "boolean",
        e: "array",
        f: "bigint",
        re: "instance",
        when: "instance",
      });
      expect(adapter.instanceCtor(entries.find(([k]) => k === "re")![1])).toBe(
        RegExp,
      );
      expect(adapter.instanceCtor(entries.find(([k]) => k === "when")![1])).toBe(
        Date,
      );
      expect(adapter.arrayElement(entries.find(([k]) => k === "e")![1])).toBeDefined();
      expect(adapter.runtimeType(adapter.arrayElement(entries.find(([k]) => k === "e")![1])!)).toBe(
        "number",
      );
    });

    test("S-instance: TypeInstance → Date/RegExp; string literals stay strings", () => {
      class Event {
        when!: Date | string;
        pattern!: RegExp | string;
        note!: string;
        constructor(init?: Partial<Event>) {
          if (init) Object.assign(this, init);
        }
      }
      const s = createSerializer();
      s.registry.setSchemaAdapter(createValibotAdapter());
      s.registry.registerType(
        "Event",
        { kind: "object", ctor: Event },
        {
          schema: v.object({
            when: v.date(),
            pattern: v.instance(RegExp),
            note: v.string(),
          }),
        },
      );

      // TypeName 描述类型 → 得到准确 JS 实例（Schema 只声明 RuntimeType，Registry 解析 TypeName）
      const e1 = s.parse<Event>(
        `Event({when:Date("2023-01-15T00:00:00.000Z"),pattern:RegExp("/a/i"),note:"x"})`,
      );
      expect(e1).toBeInstanceOf(Event);
      expect(e1.when).toBeInstanceOf(Date);
      expect(e1.pattern).toBeInstanceOf(RegExp);
      expect(e1.pattern).toBeInstanceOf(RegExp);
      expect((e1.pattern as RegExp).flags).toContain("i");
      expect(e1.note).toBe("x");

      // 字面量保真：字符串只是字符串，不用 RFC3339 / "/re/" 冒充 Date/RegExp
      const e2 = s.parse<Event>(
        `Event({when:"2023-01-15T00:00:00.000Z",pattern:"/b/g",note:"1"})`,
      );
      expect(typeof e2.when).toBe("string");
      expect(typeof e2.pattern).toBe("string");
      expect(e2.note).toBe("1"); // "1" 也不是 number
      expect(e2.when).not.toBeInstanceOf(Date);
      expect(e2.pattern).not.toBeInstanceOf(RegExp);
    });
  });

  describe("2.2 — skipped until phase unlock", () => {
    it22("S10: bigint[] element mapping", () => {
      // 解锁 2.2 后实现
      expect(true).toBe(false);
    });

    it22("S11: number[][] nested array", () => {
      expect(true).toBe(false);
    });

    it22("S12: nested object Int64 → bigint", () => {
      expect(true).toBe(false);
    });

    it22("S13: UInt8…Decimal128 × record-type", () => {
      expect(true).toBe(false);
    });

    it22("S14: object-type-property serialize", () => {
      expect(true).toBe(false);
    });

    it22("S15: object-type-property deserialize", () => {
      expect(true).toBe(false);
    });

    it22("S16: contract number receives Int64 boundary", () => {
      expect(true).toBe(false);
    });

    it22("S17: no metadata / no adapter regression to phase 1", () => {
      expect(true).toBe(false);
    });
  });
});
