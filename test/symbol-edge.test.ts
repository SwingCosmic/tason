import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";

describe("Symbol edge cases", () => {
  describe("allowUnsafeTypes gate", () => {
    test("default: Symbol TypeInstance parse throws (not registered)", () => {
      expect(() => TASON.parse(`Symbol("x")`)).toThrow();
    });

    test("default: stringify symbol value throws", () => {
      expect(() => TASON.stringify(Symbol.for("x"))).toThrow(/symbol/i);
    });

    test("allowUnsafeTypes: parse/stringify Symbol.for and well-known", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      expect(s.parse(`Symbol("aaa")`)).toBe(Symbol.for("aaa"));
      expect(s.parse(`Symbol("Symbol.iterator")`)).toBe(Symbol.iterator);
      expect(s.stringify(Symbol.for("aaa"))).toBe(`Symbol("aaa")`);
      expect(s.stringify(Symbol.iterator)).toBe(`Symbol("Symbol.iterator")`);
    });
  });

  describe("as object property VALUE", () => {
    test("string key + Symbol value round-trip", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const text = s.stringify({ a: Symbol.for("k"), t: Symbol.toStringTag });
      expect(text).toBe(`{a:Symbol("k"),t:Symbol("Symbol.toStringTag")}`);
      const obj = s.parse(text) as Record<string, symbol>;
      expect(obj.a).toBe(Symbol.for("k"));
      expect(obj.t).toBe(Symbol.toStringTag);
    });

    test("array of symbols", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const text = s.stringify([Symbol.for("a"), Symbol.iterator]);
      expect(text).toBe(`[Symbol("a"),Symbol("Symbol.iterator")]`);
      expect(s.parse(text)).toEqual([Symbol.for("a"), Symbol.iterator]);
    });
  });

  describe("as object property KEY (plain object)", () => {
    test("allowUnsafeTypes without Dictionary: symbol keys ignored (cannot express)", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: false,
        indent: false,
      });
      const o: any = { a: 1 };
      o[Symbol.for("hidden")] = 2;
      // 会尝试读 Symbol 键，但无 Dictionary 无法表达 → 忽略
      expect(s.stringify(o)).toBe("{a:1}");
    });

    test("allowUnsafeTypes + useBuiltinDictionary: plain object symbol keys → Dictionary", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: true,
        indent: false,
      });
      const o: any = { a: 1 };
      o[Symbol.for("hidden")] = 2;
      const text = s.stringify(o);
      expect(text.startsWith("Dictionary(")).toBe(true);
      expect(text).toContain(`Symbol("hidden")`);
      expect(text).toContain(`"a"`);
      const back = s.parse(text) as Map<any, any>;
      expect(back).toBeInstanceOf(Map);
      expect(back.get("a")).toBe(1);
      expect(back.get(Symbol.for("hidden"))).toBe(2);
    });

    test("without allowUnsafeTypes: symbol keys not in view (Object.entries), ignored", () => {
      const s = new TASON.Serializer({ indent: false });
      const o: any = { a: 1 };
      o[Symbol.for("hidden")] = 2;
      expect(s.stringify(o)).toBe("{a:1}");
    });

    test("[Symbol.iterator] method marks object as iterable (special protocol)", () => {
      const s = new TASON.Serializer({ indent: false });
      const o: any = {
        *[Symbol.iterator]() {
          yield 1;
          yield 2;
        },
      };
      // 按 iterable → 数组，不是 {}；iterator 本身不会当字段写出
      expect(s.stringify(o)).toBe("[1,2]");
    });

    test("[Symbol.iterator] present but not a method → error", () => {
      const s = new TASON.Serializer({ indent: false });
      const o: any = { a: 1 };
      o[Symbol.iterator] = 3; // 不是方法
      expect(() => s.stringify(o)).toThrow(/Symbol\.iterator.*not a method/i);
    });

    test("[Symbol.asyncIterator] not a method → error; method → async unsupported", () => {
      const s = new TASON.Serializer({ indent: false });
      const bad: any = { a: 1 };
      bad[Symbol.asyncIterator] = "nope";
      expect(() => s.stringify(bad)).toThrow(/Symbol\.asyncIterator.*not a method/i);

      const good: any = {
        async *[Symbol.asyncIterator]() {
          yield 1;
        },
      };
      expect(() => s.stringify(good)).toThrow(/async iterable/i);
    });

    test("protocol symbols never appear as object fields in output", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      // 无 iterator 协议时：其它 Symbol 键丢弃，字符串键正常；输出不含 Symbol( 字段键形态
      const o: any = { a: 1, b: Symbol.for("val") };
      o[Symbol.toStringTag] = "Tag";
      expect(s.stringify(o)).toBe(`{a:1,b:Symbol("val")}`);
      // 有合法 iterator 时走数组，字段 a / 协议键都不会以对象字段形式出现
      const it: any = {
        a: 99,
        *[Symbol.iterator]() {
          yield "x";
        },
      };
      expect(s.stringify(it)).toBe(`["x"]`);
    });

    test("TASON grammar cannot use TypeInstance as object key", () => {
      const s = new TASON.Serializer({ allowUnsafeTypes: true });
      expect(() => s.parse(`{Symbol("k"):1}`)).toThrow();
    });
  });

  describe("as Map / Dictionary key", () => {
    test("useBuiltinDictionary + allowUnsafeTypes: Symbol key round-trip", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: true,
        indent: false,
      });
      const m = new Map<any, any>([
        [Symbol.toStringTag, "bar"],
        [Symbol.for("k"), 1],
        ["str", true],
      ]);
      const text = s.stringify(m);
      expect(text.startsWith("Dictionary(")).toBe(true);
      expect(text).toContain(`Symbol("Symbol.toStringTag")`);
      expect(text).toContain(`Symbol("k")`);
      const back = s.parse(text) as Map<any, any>;
      expect(back).toBeInstanceOf(Map);
      expect(back.get(Symbol.toStringTag)).toBe("bar");
      expect(back.get(Symbol.for("k"))).toBe(1);
      expect(back.get("str")).toBe(true);
    });

    test("useBuiltinDictionary without allowUnsafeTypes: symbol key throws", () => {
      const s = new TASON.Serializer({
        useBuiltinDictionary: true,
        allowUnsafeTypes: false,
        indent: false,
      });
      const m = new Map<any, any>([
        [Symbol.for("k"), 1],
        ["ok", 2],
      ]);
      // Map 中的 symbol 已进入序列化逻辑 → 报错，不可静默丢弃
      expect(() => s.stringify(m)).toThrow(/allowUnsafeTypes/i);
    });

    test("without useBuiltinDictionary + allowUnsafeTypes: symbol keys skipped, string kept", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: false,
        indent: false,
      });
      const m = new Map<any, any>([
        [Symbol.for("k"), 1],
        ["a", 2],
      ]);
      // 对象语法无法表达 Symbol 键；仅保留字符串键
      expect(s.stringify(m)).toBe(`{a:2}`);
    });

    test("without useBuiltinDictionary without allowUnsafeTypes: symbol key throws", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: false,
        useBuiltinDictionary: false,
        indent: false,
      });
      expect(() =>
        s.stringify(
          new Map<any, any>([
            [Symbol.for("k"), 1],
            ["a", 2],
          ]),
        ),
      ).toThrow(/allowUnsafeTypes/i);
    });
  });

  describe("local / empty / identity traps", () => {
    test("local Symbol() and Symbol(desc) cannot serialize", () => {
      const s = new TASON.Serializer({ allowUnsafeTypes: true });
      expect(() => s.stringify(Symbol())).toThrow(/local/i);
      expect(() => s.stringify(Symbol("only-local"))).toThrow(/local/i);
    });

    test("empty description Symbol.for('') round-trips", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const sym = Symbol.for("");
      const text = s.stringify(sym);
      expect(s.parse(text)).toBe(Symbol.for(""));
    });

    test("Symbol.for('Symbol.iterator') collapses to well-known on deserialize", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const globalNamed = Symbol.for("Symbol.iterator");
      const text = s.stringify(globalNamed);
      expect(text).toBe(`Symbol("Symbol.iterator")`);
      const back = s.parse(text);
      expect(back).toBe(Symbol.iterator);
      expect(back).not.toBe(globalNamed);
    });

    test("description with special chars", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const name = 'a"b\\c';
      const text = s.stringify(Symbol.for(name));
      expect(s.parse(text)).toBe(Symbol.for(name));
    });
  });

  describe("Dictionary filter: symbol as value", () => {
    test("Map string key + symbol value with allowUnsafeTypes", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: true,
        indent: false,
      });
      const m = new Map<any, any>([["k", Symbol.for("v")]]);
      const text = s.stringify(m);
      expect(text).toContain(`Symbol("v")`);
      const back = s.parse(text) as Map<any, any>;
      expect(back.get("k")).toBe(Symbol.for("v"));
    });

    test("Map string key + symbol value without allowUnsafeTypes: throws", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: false,
        useBuiltinDictionary: true,
        indent: false,
      });
      const m = new Map<any, any>([
        ["k", Symbol.for("v")],
        ["ok", 1],
      ]);
      expect(() => s.stringify(m)).toThrow(/allowUnsafeTypes/i);
    });

    test("object string key + symbol value without allowUnsafeTypes: throws", () => {
      const s = new TASON.Serializer({ indent: false });
      expect(() => s.stringify({ a: Symbol.for("x") })).toThrow(/symbol/i);
    });

    test("array symbol element without allowUnsafeTypes: throws", () => {
      const s = new TASON.Serializer({ indent: false });
      expect(() => s.stringify([1, Symbol.for("x")])).toThrow(/symbol/i);
    });
  });
});
