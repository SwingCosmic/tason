import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { UInt8, Decimal128, Int16, Int32, Int64 } from "@/types/numbers";
import { JSON as _JSON } from "@/types/json";
import { Buffer as _Buffer } from "@/types/Buffer";
import { DateOnly, TimeOnly } from "@/types/date";

describe("内置类型序列化测试", () => {
  test("numbers", () => {
    expect(TASON.stringify(new UInt8("64")))
      .toEqual(`UInt8("64")`);
    expect(TASON.stringify(new Int16("-0xAB")))
      .toEqual(`Int16("-171")`);
    expect(TASON.stringify(new Int32("0o123456")))
      .toEqual(`Int32("42798")`);
    expect(TASON.stringify(new Int64("0xabCDef123456789")))
      .toEqual(`Int64("773738363261118345")`);
    expect(TASON.stringify(new Decimal128('3.141592653589793238462643383279')))
      .toEqual(`Decimal128("3.141592653589793238462643383279")`);
    expect(TASON.stringify(2n ** 128n))
      .toEqual(`BigInt("340282366920938463463374607431768211456")`);
  });

  test("RegExp", () => {
    expect(TASON.stringify(/^[a-zA-Z0-9]+$/ig))
      .toEqual(`RegExp("/^[a-zA-Z0-9]+$/gi")`);
    
    // 正则表达式中的 / 的转义 `\/` 在字符串中不需要
    expect(TASON.stringify(/\/\w+\/$/))
      .toEqual(`RegExp("//\\\\w+/$/")`);
  });

  test("JSON", () => {
    expect(TASON.stringify(new _JSON(`null`)))
      .toEqual(`JSON("null")`);
    expect(TASON.stringify(new _JSON(`[1,2,3]`)))
      .toEqual(`JSON("[1,2,3]")`);
    expect(TASON.stringify(new _JSON(`[1,2,3]`, "array")))
      .toEqual(`JSONArray("[1,2,3]")`);
    expect(TASON.stringify(new _JSON(`{"\\n嗯嗯嗯\\n":1}`, "object")))
      .toEqual(`JSONObject("{\\"\\\\n嗯嗯嗯\\\\n\\":1}")`);
  });

  test("Buffer", () => {
    expect(TASON.stringify(new _Buffer(`Base64, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`)))
      .toEqual(`Buffer("base64,eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")`);
    expect(TASON.stringify(new _Buffer(`hex, 2e09c9650a9779f1ce8dc232881f06736c6e5e0a3236292d2679ffce2e9f49bc`)))
      .toEqual(`Buffer("hex,2E09C9650A9779F1CE8DC232881F06736C6E5E0A3236292D2679FFCE2E9F49BC")`);
  });

  test("Date", () => {
    expect(TASON.stringify(new Date("2023-01-15 00:00:00Z")))
      .toEqual(`Date("2023-01-15T00:00:00.000Z")`);

    expect(TASON.stringify(new DateOnly(new Date(2024, 3, 26))))
      .toEqual(`DateOnly("2024-04-26")`);

    expect(TASON.stringify(new TimeOnly(new Date("1919-08-10 11:45:14"))))
      .toEqual(`TimeOnly("11:45:14.000")`);
  });
});
