import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { Byte, Decimal128, Int16, Int32, Int64 } from "@/types/numbers";


describe("内置类型序列化测试", () => {
  test("numbers", () => {
    expect(TASON.stringify(new Byte("64")))
      .toEqual(`Byte("64")`);
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
  })
});
