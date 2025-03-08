import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { Byte, Decimal128, Int16, Int32, Int64 } from "@/types/numbers";
import { JSON as _JSON } from "@/types/json";
import { Buffer as _Buffer } from "@/types/Buffer";
import { UUID } from "@/types/UUID";
import { Timestamp } from "@/types/date";


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

    const now = Date.now();
    expect(TASON.parse(`Timestamp('${now}')`))
      .toEqual(new Timestamp(now));

    expect(TASON.parse(`Timestamp('-10000000')`))
      .toEqual(new Timestamp(new Date(-10000000).getTime()));
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
    expect(TASON.parse<_JSON>(`JSONArray('[1,2,3]')`).toJSONValue())
      .toEqual(new _JSON(`[1,2,3]`).toJSONValue());
    expect(TASON.parse<_JSON>(`JSONObject('  \\r\\n{ \\"嗯嗯嗯\\": 1}')`).toJSONValue())
      .toEqual(new _JSON(`{"嗯嗯嗯":1}`).toJSONValue());

    expect(() => TASON.parse(`JSONObject('[]')`)).toThrow();
    expect(() => TASON.parse(`JSONArray('"666"')`)).toThrow();
  });

  test("Buffer", () => {
    expect(TASON.parse<_Buffer>(`Buffer('base64,eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')`).toArrayBuffer())
      .toEqual(Buffer.from("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "base64").buffer);
    expect(TASON.parse<_Buffer>(`Buffer('HEX, 2E09C9650A9779F1CE8DC232881F06736C6E5E0A3236292D2679FFCE2E9F49BC')`).toNodeBuffer())
      .toEqual(Buffer.from("2e09c9650a9779f1ce8dc232881f06736c6e5e0a3236292d2679ffce2e9f49bc", "hex"));
    
    expect(() => TASON.parse<_Buffer>(`Buffer('hex,\\0\\x03\\xa0\\b')`)).toThrow();
    expect(() => TASON.parse<_Buffer>(`Buffer('base64, jdsfyjf%$@#$#')`)).toThrow();
  });

  test("UUID", () => {
    expect(TASON.parse<UUID>(`UUID('91610333-A4B6-4F39-865F-15E0079DE6B1')`))
      .toEqual(new UUID("91610333-a4b6-4f39-865f-15e0079de6b1"));

    expect(() => TASON.parse<UUID>(`UUID('{49147ae5-0929-4faf-ba9e-e29fc0ae662c}')`)).toThrow();
  });
});
