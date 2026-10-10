import { describe, expect, test } from "@jest/globals";
import { parseSyntax } from "@/syntax/parseSyntax";

describe("syntax-parse", () => {
  test("对象 AST 形状与偏移", () => {
    const result = parseSyntax(`{ a: 1, "b c": [true, null] }`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ast).toMatchObject({
      type: "ObjectExpression",
      start: 0,
      end: 29,
      properties: [
        {
          type: "ObjectProperty",
          start: 2,
          end: 6,
          key: { type: "Identifier", name: "a", start: 2, end: 3 },
          value: { type: "NumericLiteral", raw: "1", start: 5, end: 6 },
        },
        {
          type: "ObjectProperty",
          key: { type: "StringLiteral", value: "b c", raw: `"b c"`, start: 8, end: 13 },
          value: {
            type: "ArrayExpression",
            start: 15,
            end: 27,
            elements: [
              { type: "BooleanLiteral", value: true },
              { type: "NullLiteral" },
            ],
          },
        },
      ],
    });
  });

  test("TypeInstance 标量与对象形态", () => {
    const result = parseSyntax(`[Int64("5"), Unknown_9({ x: 1 })]`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ast).toMatchObject({
      type: "ArrayExpression",
      start: 0,
      elements: [
        {
          type: "TypeInstance",
          start: 1,
          end: 11,
          typeName: { type: "Identifier", name: "Int64", start: 1, end: 6 },
          argument: { type: "StringLiteral", value: "5", raw: `"5"`, start: 7, end: 10 },
        },
        {
          type: "TypeInstance",
          typeName: { type: "Identifier", name: "Unknown_9" },
          argument: { type: "ObjectExpression", properties: [{ key: { name: "x" } }] },
        },
      ],
    });
  });

  test("未注册 TypeName 合法（不依赖 Registry）", () => {
    const result = parseSyntax(`NoSuchType({ deep: { list: [Another("arg")] } })`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ast?.type).toBe("TypeInstance");
  });

  test("数值符号 / 进制 / NaN / Infinity", () => {
    const result = parseSyntax(`[+5, - 0x1F, .5e2, - Infinity, NaN, -0]`);
    expect(result.diagnostics).toEqual([]);
    expect(result.ast).toMatchObject({
      elements: [
        { type: "NumericLiteral", sign: "+", raw: "5" },
        { type: "NumericLiteral", sign: "-", raw: "0x1F" },
        { type: "NumericLiteral", sign: undefined, raw: ".5e2" },
        { type: "NumericLiteral", sign: "-", raw: "Infinity" },
        { type: "NumericLiteral", sign: undefined, raw: "NaN" },
        { type: "NumericLiteral", sign: "-", raw: "0" },
      ],
    });
  });

  test("字符串转义解码", () => {
    const result = parseSyntax(`{ s: "a\\u0062c\\x41\\n\\t", t: 'it\\'s' }`);
    const object = result.ast as any;
    expect(object.properties[0].value).toMatchObject({
      value: "abcA\n\t",
      raw: `"a\\u0062c\\x41\\n\\t"`,
    });
    expect(object.properties[1].value).toMatchObject({ value: "it's" });
  });

  test("行注释与块注释全量收集（含文件尾）", () => {
    const text = [
      `// head`,
      `{ /* 块 a */`,
      `  // 行 a`,
      `  a: 1,`,
      `} /* 行内 */`,
      `// tail`,
    ].join("\n");
    const result = parseSyntax(text);
    expect(result.diagnostics).toEqual([]);
    expect(result.comments.map((c) => ({ type: c.type, value: c.value }))).toEqual([
      { type: "CommentLine", value: " head" },
      { type: "CommentBlock", value: " 块 a " },
      { type: "CommentLine", value: " 行 a" },
      { type: "CommentBlock", value: " 行内 " },
      { type: "CommentLine", value: " tail" },
    ]);
    // 偏移是 parseSyntax 的公开承诺，抽查首尾
    expect(result.comments[0]).toMatchObject({ start: 0, end: 7 });
    expect(result.comments[4]).toMatchObject({ start: 48, end: 55 });
  });

  test("语法错误产生诊断（对象）", () => {
    const result = parseSyntax("{,}");
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].line).toBe(0);
    expect(typeof result.diagnostics[0].offset).toBe("number");
  });

  test("非法字符转诊断（INVALID_CHAR throw）", () => {
    const result = parseSyntax("{ a: ! }");
    expect(result.ast).toBeNull();
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0].message).toMatch(/Invalid character/);
    expect(result.diagnostics[0]).toMatchObject({ offset: 5, line: 0, column: 5 });
  });

  test("值缺失时诊断非空、AST 不可用", () => {
    const result = parseSyntax(`{ a: 1, b: }`);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.ast).toBeNull();
  });

  test("轻微错误下尽力给出部分树", () => {
    const result = parseSyntax(`{ a: 1 b: 2 }`);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.ast?.type).toBe("ObjectExpression");
  });

  test("空输入", () => {
    const result = parseSyntax("");
    expect(result.ast).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
