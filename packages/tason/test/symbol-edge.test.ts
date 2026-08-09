import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";

describe("Symbol edge cases", () => {
  describe("allowUnsafeTypes gate", () => {
    test("default parse", () => {
      // 未注册 Symbol TypeInstance
      expect(() => TASON.parse(`Symbol("x")`)).toThrow();
    });

    test("default stringify", () => {
      expect(() => TASON.stringify(Symbol.for("x"))).toThrow(/symbol/i);
    });

    test("allowUnsafeTypes parse and stringify", () => {
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

  describe("as property value", () => {
    test("object string key", () => {
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

    test("array element", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const text = s.stringify([Symbol.for("a"), Symbol.iterator]);
      expect(text).toBe(`[Symbol("a"),Symbol("Symbol.iterator")]`);
      expect(s.parse(text)).toEqual([Symbol.for("a"), Symbol.iterator]);
    });
  });

  describe("as property key on plain object", () => {
    test("allowUnsafeTypes without Dictionary", () => {
      // 对象语法无法表达 Symbol 键 → 忽略
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: false,
        indent: false,
      });
      const o: any = { a: 1 };
      o[Symbol.for("hidden")] = 2;
      expect(s.stringify(o)).toBe("{a:1}");
    });

    test("allowUnsafeTypes with Dictionary", () => {
      // 含 Symbol 键时提升为 Dictionary
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

    test("without allowUnsafeTypes", () => {
      // Object.entries 看不到 Symbol 键
      const s = new TASON.Serializer({ indent: false });
      const o: any = { a: 1 };
      o[Symbol.for("hidden")] = 2;
      expect(s.stringify(o)).toBe("{a:1}");
    });

    test("Symbol.iterator method", () => {
      // 合法 iterator 协议 → 按 iterable 写成数组，不写对象字段
      const s = new TASON.Serializer({ indent: false });
      const o: any = {
        *[Symbol.iterator]() {
          yield 1;
          yield 2;
        },
      };
      expect(s.stringify(o)).toBe("[1,2]");
    });

    test("Symbol.iterator non-method", () => {
      const s = new TASON.Serializer({ indent: false });
      const o: any = { a: 1 };
      o[Symbol.iterator] = 3;
      expect(() => s.stringify(o)).toThrow(/Symbol\.iterator.*not a method/i);
    });

    test("Symbol.asyncIterator", () => {
      const s = new TASON.Serializer({ indent: false });
      const bad: any = { a: 1 };
      bad[Symbol.asyncIterator] = "nope";
      expect(() => s.stringify(bad)).toThrow(
        /Symbol\.asyncIterator.*not a method/i,
      );

      const good: any = {
        async *[Symbol.asyncIterator]() {
          yield 1;
        },
      };
      expect(() => s.stringify(good)).toThrow(/async iterable/i);
    });

    test("protocol vs data symbols", () => {
      // 无 iterator：数据 Symbol 值可写，Symbol 键丢弃
      // 有合法 iterator：整对象当数组，字段与协议键都不以对象字段出现
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const o: any = { a: 1, b: Symbol.for("val") };
      o[Symbol.toStringTag] = "Tag";
      expect(s.stringify(o)).toBe(`{a:1,b:Symbol("val")}`);

      const it: any = {
        a: 99,
        *[Symbol.iterator]() {
          yield "x";
        },
      };
      expect(s.stringify(it)).toBe(`["x"]`);
    });

    test("TypeInstance as object key in grammar", () => {
      const s = new TASON.Serializer({ allowUnsafeTypes: true });
      expect(() => s.parse(`{Symbol("k"):1}`)).toThrow();
    });
  });

  describe("as Map key", () => {
    test("Dictionary with allowUnsafeTypes", () => {
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

    test("Dictionary without allowUnsafeTypes", () => {
      // Map 内 symbol 已进入序列化逻辑 → 报错，不可静默丢弃
      const s = new TASON.Serializer({
        useBuiltinDictionary: true,
        allowUnsafeTypes: false,
        indent: false,
      });
      const m = new Map<any, any>([
        [Symbol.for("k"), 1],
        ["ok", 2],
      ]);
      expect(() => s.stringify(m)).toThrow(/allowUnsafeTypes/i);
    });

    test("plain object Map with allowUnsafeTypes", () => {
      // 无 Dictionary：仅保留字符串键
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        useBuiltinDictionary: false,
        indent: false,
      });
      const m = new Map<any, any>([
        [Symbol.for("k"), 1],
        ["a", 2],
      ]);
      expect(s.stringify(m)).toBe(`{a:2}`);
    });

    test("plain object Map without allowUnsafeTypes", () => {
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

  describe("identity and description", () => {
    test("local Symbol", () => {
      const s = new TASON.Serializer({ allowUnsafeTypes: true });
      expect(() => s.stringify(Symbol())).toThrow(/local/i);
      expect(() => s.stringify(Symbol("only-local"))).toThrow(/local/i);
    });

    test("empty description", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const sym = Symbol.for("");
      const text = s.stringify(sym);
      expect(s.parse(text)).toBe(Symbol.for(""));
    });

    test("Symbol.for vs well-known name collision", () => {
      // 反序列化时 "Symbol.iterator" 解析为 well-known，不是全局 registry 同名项
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

    test("special characters in description", () => {
      const s = new TASON.Serializer({
        allowUnsafeTypes: true,
        indent: false,
      });
      const name = 'a"b\\c';
      const text = s.stringify(Symbol.for(name));
      expect(s.parse(text)).toBe(Symbol.for(name));
    });
  });

  describe("as Map or object value", () => {
    test("Map value with allowUnsafeTypes", () => {
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

    test("Map value without allowUnsafeTypes", () => {
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

    test("object value without allowUnsafeTypes", () => {
      const s = new TASON.Serializer({ indent: false });
      expect(() => s.stringify({ a: Symbol.for("x") })).toThrow(/symbol/i);
    });

    test("array element without allowUnsafeTypes", () => {
      const s = new TASON.Serializer({ indent: false });
      expect(() => s.stringify([1, Symbol.for("x")])).toThrow(/symbol/i);
    });
  });
});
