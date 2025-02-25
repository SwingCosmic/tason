import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { Byte, Decimal128, Int16, Int32, Int64 } from "@/types/numbers";
import { JSON as _JSON } from "@/types/json";


describe("内置类型解析测试", () => {
  test("numbers", () => {
    expect(TASON.parse('Byte("64")'))
      .toEqual(new Byte('64'));
    expect(TASON.parse("Int16('-0xAB')"))
      .toEqual(new Int16('-0xAB'));
    expect(TASON.parse("Int32('0o123456')"))
      .toEqual(new Int32('0o123456'));
    expect(TASON.parse("Int64('0xabCDef123456789')"))
      .toEqual(new Int64('0xABcdEF123456789'));
    expect(TASON.parse("Decimal128('3.141592653589793238462643383279')"))
      .toEqual(new Decimal128('3.141592653589793238462643383279'));
    expect(TASON.parse("BigInt('340282366920938463463374607431768211456')"))
      .toEqual(2n ** 128n);

    expect(() => TASON.parse(`Byte('-100')`)).toThrow();
    expect(() => TASON.parse(`Int16('30023.43')`)).toThrow();
    expect(() => TASON.parse(`Int16('.5443')`)).toThrow();
    expect(TASON.parse(`Int16('8080.')`)).toEqual(new Int16('8080'));
    expect(() => TASON.parse(`Int32('${Int32.MAX_VALUE + 1}')`)).toThrow();
    expect(() => TASON.parse(`Int64('${2n ** 64n}')`)).toThrow();
  });

  test("RegExp", () => {
    expect(TASON.parse(`RegExp("/[A-Z]+/")`))
      .toEqual(/[A-Z]+/);
    expect(TASON.parse(`RegExp('/([A-Z]+)\\\\1/ig')`))
      .toEqual(new RegExp(/([A-Z]+)\1/, "gi"));
    
    // 无需转义/，并且不会与行内注释冲突
    expect(TASON.parse(`RegExp("//(.+)//i")///\\\\/(.+)\\\\//i`))
      .toEqual(/\/(.+)\//i);
  });

  test("Date", () => {
    expect(TASON.parse(`Date("2023-01-02 00:00:00")`))
      .toEqual(new Date("2023-01-02T00:00:00.000"));

    expect(TASON.parse(`Date("2025-02-01Z")`))
      .toEqual(new Date("2025-02-01T00:00:00Z"));

    expect(TASON.parse(`Date("1919-08-10T11:45:14+09:00")`))
      .toEqual(new Date("1919-08-10T11:45:14+09:00"));

    expect(() => TASON.parse(`Date("34543-87-18")`)).toThrow();
  });


  test("Symbol", () => {
    const s = new TASON.Serializer({
      allowUnsafeTypes: true
    });

    expect(s.parse(`Symbol('aaa')`)).toBe(Symbol.for('aaa'));
    expect(s.parse(`Symbol("Symbol.iterator")`)).toBe(Symbol.iterator);
    expect(s.parse(`{a: Symbol("Symbol.toStringTag")}`)).toEqual({ a: Symbol.toStringTag })


    expect(() => TASON.parse(`Symbol('Symbol.iterator')`)).toThrow();

  });

  test("JSON", () => {
    expect(TASON.parse<_JSON>(` JSON('null')`))
      .toEqual(new _JSON(`null`));
    expect(TASON.parse<_JSON>(`JSONArray('[1,2,3]')`).toJSON())
      .toEqual(new _JSON(`[1,2,3]`).toJSON());
    expect(TASON.parse<_JSON>(`JSONObject('  \\r\\n{ \\"嗯嗯嗯\\": 1}')`).toJSON())
      .toEqual(new _JSON(`{"嗯嗯嗯":1}`).toJSON());

    expect(() => TASON.parse(`JSONObject('[]')`)).toThrow();
    expect(() => TASON.parse(`JSONArray('"666"')`)).toThrow();
  });
});
