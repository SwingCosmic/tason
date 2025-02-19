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
});
