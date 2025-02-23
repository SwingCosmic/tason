import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";

describe("JSON5 兼容性测试", () => {
  test("null", () => {
    expect(TASON.parse("null")).toEqual(null);
  });

  test("boolean", () => {
    expect(TASON.parse("true")).toEqual(true);
    expect(TASON.parse("false")).toEqual(false);
  });

  test("string", () => {
    expect(TASON.parse(`'test'`)).toEqual("test");
    expect(TASON.parse(`"test"`)).toEqual("test");
    expect(TASON.parse(`''`)).toEqual("");
    expect(TASON.parse(`""`)).toEqual("");

    expect(TASON.parse(`'\\'test\\''`)).toEqual("'test'");
    expect(TASON.parse(`"\\"test\\""`)).toEqual('"test"');

    // js不需要转义正斜杠'/'，因此'\\/'转义后仍为原样，这和JSON5将'\\/'转义为'/'不一样
    const i = `'\\\\\\b\\f\\n\\r\\t\\v\\0\\x0f\\u01fF\\u2028\\u2029\\'\\"\\/'`;
    const o = `\\\b\f\n\r\t\v\0\x0f\u01FF\u2028\u2029'"\\/`;
    expect(TASON.parse(i)).toEqual(o);

    expect(TASON.parse(`'🐔鈮钛镁😓'`)).toEqual(
      `\uD83D\uDC14\u922E\u949B\u9541\uD83D\uDE13`
    );

    // js支持，但TASON标准没有定义的Unicode转义
    expect(() =>
      TASON.parse(
        `'\\u{D83D}\\u{DC14}\\u{922E}\\u{949B}\\u{9541}\\u{D83D}\\u{DE13}'`
      )
    ).toThrow(); // `\uD83D\uDC14\u922E\u949B\u9541\uD83D\uDE13`

    expect(() => TASON.parse(`'aaa\nbbb'`)).toThrow();
    expect(() => TASON.parse(`'aaa\n\rbbb'`)).toThrow();
    // 去掉JSON5中允许转义换行符，从而让字符串跨域多行的写法。
    expect(() => TASON.parse(`'aaa\\\nbbb'`)).toThrow();
    expect(() => TASON.parse(`'aaa\\\n\\\rbbb'`)).toThrow();
  });

  test("number", () => {

    expect(TASON.parse("[0, +1, -1, 1.5, -1.5]")).toEqual([0, 1, -1, 1.5, -1.5]);
    // HACK: jest认为0 != -0
    expect(TASON.parse("-0") === 0).toBe(true);
    expect(TASON.parse("[.01, 10., -.01, -10.]")).toEqual([0.01, 10, -0.01, -10]);
    expect(TASON.parse("[1e8, -1.2e5, 2e-5, 2e0]")).toEqual([1e8, -1.2e5, 2e-5, 2]);
    expect(TASON.parse("[NaN, -NaN, Infinity, -Infinity]")).toEqual([NaN, NaN, Infinity, -Infinity]);
    expect(TASON.parse("[-0b101010, 0o12345, 0xAbcd3Ef]")).toEqual([-0b101010, 0o12345, 0xAbcd3Ef]);
    // 不允许0开头的八进制数字
    expect(() => TASON.parse("012345")).toThrow();
    expect(() => TASON.parse("-0372.1")).toThrow();

    
    expect(() => TASON.parse("0Xab3f")).toThrow();
    expect(() => TASON.parse("0O443")).toThrow();
    expect(() => TASON.parse("0B110")).toThrow();
  });

  test("array", () => {
    expect(TASON.parse("[ \n]")).toEqual([]);
    expect(TASON.parse("[\n1, \t'2', \r{}]")).toEqual([1, '2', {}]);
    expect(TASON.parse("[BigInt('-1'), [[3, [4, ]], ], ]")).toEqual([-1n, [[3, [4]]]]);

  });

  test("object", () => {
    expect(TASON.parse(`{ \n}`)).toEqual({});
    expect(TASON.parse(`{"啊":{'b^$\\"':{"\\x0f": [666,],"🦶\uD83D\uDE0B": "👍"},},}`))
      .toEqual({ 啊: {'b^$"': {"\x0f": [666], "🦶😋": "👍"}}});
    expect(TASON.parse(`{\n\t"a": BigInt('-1'),\n\t"b": "2"  ,\t"c": {}\n}`))
      .toEqual({ a: -1n, b: "2", c: {} });

    // 虽然我不知道下面这个测试有什么意义，但JSON5官方加了可能是有用吧，
    // 能够证明它没有使用js解析从而避免通过__proto__设置原型？
    const a: any = {};
    a.__proto__ = 42;
    const b = TASON.parse('{"__proto__":42}');
    expect(Object.getPrototypeOf(b)).toEqual(Object.prototype);
    expect(b).toEqual(a);

    expect(() => TASON.parse(`{ùńîċõďë: 'No'}`)).toThrow();
    expect(() => TASON.parse(`{#_: '?'}`)).toThrow();
    expect(() => TASON.parse(`{_$_:2}`)).toThrow();
  });

  test("comments", () => {
    expect(TASON.parse(`// comment\r\n[1, 2, 3]`)).toEqual([1, 2, 3]);
    expect(TASON.parse(`/* comment */[1, 2, 3]`)).toEqual([1, 2, 3]);
    expect(TASON.parse(`{/** \n * @type {a:number} \n */s: {a:1}}`)).toEqual({s: {a:1}});
    expect(TASON.parse(`[1, /* 2, // */ 3]// comment`)).toEqual([1, 3]);
  });

  test("whitespace", () => {
    expect(() => TASON.parse(`[1, \v 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \f 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \b 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \x00 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \u2028 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \u2029 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \u200B 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \u00A0 2]`)).toThrow();
    expect(() => TASON.parse(`[1, \u3000 2]`)).toThrow();
  })
});
