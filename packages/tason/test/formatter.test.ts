import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { formatTASON } from "@/syntax/format/formatTASON";

const FIXTURES = [
  `{a:1}`,
  `{ a: 1, b: [2, 3], c: { d: "x" } }`,
  `[true, false, null, NaN, -Infinity, +5, - 0x1F, .5e2, -0]`,
  `Int64("9223372036854775807")`,
  `{ user: { name: "n", tags: [1, 2] } }`,
  `{ "quoted-key": 'single', "true": 1, "": 2, "\u0061bc": 3 }`,
  `{"s":"a\\u0062c\\n","t":'{\\'}'}`,
  `[{ nested: { deep: [{ x: 1 }] } }]`,
  `[1, 2,]`,
  `{ e: "😀", l: "\\ud800", c: "\\u0001" }`,
];

describe("formatter 基础风格", () => {
  test("短文档保持单行", () => {
    expect(formatTASON(`{a:1,b:2}`).text).toBe(`{ a: 1, b: 2 }\n`);
    expect(formatTASON(`[1,2]`).text).toBe(`[1, 2]\n`);
    expect(formatTASON(`{}`).text).toBe(`{}\n`);
    expect(formatTASON(`[]`).text).toBe(`[]\n`);
    expect(formatTASON(`Name({})`).text).toBe(`Name({})\n`);
  });

  test("超宽展开与尾逗号", () => {
    expect(formatTASON(`{aaa: 1, bbb: 22}`, { printWidth: 12 }).text).toBe(
      [
        "{",
        "  aaa: 1,",
        "  bbb: 22,",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("嵌套 group 独立判定", () => {
    // 根超宽展开；内层对象在自身列宽内 → 平铺
    expect(formatTASON(`{a:{b:1,c:2}}`, { printWidth: 20 }).text).toBe(
      [
        "{",
        "  a: { b: 1, c: 2 },",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("TypeInstance 展开", () => {
    expect(formatTASON(`User({name:"x",age:1})`, { printWidth: 10 }).text).toBe(
      [
        "User({",
        "  name: \"x\",",
        "  age: 1,",
        "})",
        "",
      ].join("\n"),
    );
  });

  test("trailingComma none", () => {
    expect(formatTASON(`{aaa: 1, bbb: 22}`, { printWidth: 12, trailingComma: "none" }).text).toBe(
      [
        "{",
        "  aaa: 1,",
        "  bbb: 22",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("缩进：tab 与宽度", () => {
    expect(formatTASON(`{aaa: 1}`, { printWidth: 8, useTabs: true }).text).toBe(
      "{\n\taaa: 1,\n}\n",
    );
    expect(formatTASON(`{aaa: 1}`, { printWidth: 8, tabWidth: 4 }).text).toBe(
      "{\n    aaa: 1,\n}\n",
    );
  });

  test("endOfLine crlf", () => {
    expect(formatTASON(`{aaa: 1}`, { printWidth: 8, endOfLine: "crlf" }).text).toBe(
      "{\r\n  aaa: 1,\r\n}\r\n",
    );
  });
});

describe("formatter 字符串与 key", () => {
  test("引号切换与必要转义", () => {
    expect(formatTASON(`{ s: "it's", t: 'say "hi"' }`).text).toBe(
      `{ s: "it's", t: "say \\"hi\\"" }\n`,
    );
    expect(formatTASON(`{ s: "it's", t: 'say "hi"' }`, { singleQuote: true }).text).toBe(
      `{ s: 'it\\'s', t: 'say "hi"' }\n`,
    );
  });

  test("控制字符重转义", () => {
    // 无短名的控制字符输出 \xXX 短形态；NUL 有专属 \0
    expect(formatTASON(`{ s: "\\u0001\\u001f\\u0000" }`).text).toBe(`{ s: "\\x01\\x1f\\0" }\n`);
    expect(formatTASON(`{ s: "a\\tb\\nc" }`).text).toBe(`{ s: "a\\tb\\nc" }\n`);
    expect(formatTASON(`{ s: "\\x0b\\x08\\x0c" }`).text).toBe(`{ s: "\\v\\b\\f" }\n`);
  });

  test("quoteKeys as-needed（默认）", () => {
    expect(formatTASON(`{ "a": 1, "a-b": 2, "true": 4, "": 5 }`).text).toBe(
      `{ a: 1, "a-b": 2, "true": 4, "": 5 }\n`,
    );
    // 解码后整匹配 IDENTIFIER 词法的同样可去引号
    expect(formatTASON(`{ "\\u0061bc": 3 }`).text).toBe(`{ abc: 3 }\n`);
  });

  test("quoteKeys preserve", () => {
    expect(formatTASON(`{ "a": 1 }`, { quoteKeys: "preserve" }).text).toBe(`{ "a": 1 }\n`);
  });
});

describe("formatter 数值原样（优化未实施）", () => {
  test("符号 / 进制 / 指数 / NaN / Infinity 原样保留", () => {
    expect(formatTASON(`[+5, - 0x1F, .5e2, - Infinity, NaN, -0, 1.50]`).text).toBe(
      `[+5, -0x1F, .5e2, -Infinity, NaN, -0, 1.50]\n`,
    );
  });

  test("optimize* 传 true 等价 false", () => {
    const src = `[+5, - 0x1F, .5e2, -0, - Infinity]`;
    const expected = formatTASON(src).text;
    expect(formatTASON(src, {
      optimizeNumbers: true,
      optimizeNumberTypeInstances: true,
      optimizeBlockComments: true,
    }).text).toBe(expected);
    expect(expected).toBe(`[+5, -0x1F, .5e2, -0, -Infinity]\n`);
  });

  test("数值 TypeInstance 参数字符串原样", () => {
    expect(formatTASON(`Int64("  +0005 ")`).text).toBe(`Int64("  +0005 ")\n`);
  });
});

describe("formatter 注释", () => {
  test("四类归属与空行保留", () => {
    const src = [
      `// head`,
      `{`,
      `  // leading a`,
      `  a: 1, // trailing a`,
      ``,
      `  // leading b`,
      `  b: [`,
      `    2, // in array`,
      `    // dangling array`,
      `  ],`,
      `  /* dangling object */`,
      `}`,
      `// tail`,
    ].join("\n");
    const expected = [
      `// head`,
      `{`,
      `  // leading a`,
      `  a: 1,  // trailing a`,
      ``,
      `  // leading b`,
      `  b: [`,
      `    2,  // in array`,
      `    // dangling array`,
      `  ],`,
      `  /* dangling object */`,
      `}`,
      `// tail`,
      ``,
    ].join("\n");
    expect(formatTASON(src).text).toBe(expected);
  });

  test("块注释行内保留", () => {
    expect(formatTASON(`{ a: 1 /* keep  exact */ }`).text).toBe(
      `{ a: 1 /* keep  exact */ }\n`,
    );
    expect(formatTASON(`Int64("1" /* c */)`).text).toBe(`Int64("1" /* c */)\n`);
  });

  test("行注释强制容器展开", () => {
    expect(formatTASON(`[1 // c\n]`).text).toBe(`[\n  1,  // c\n]\n`);
  });

  test("空容器 dangling", () => {
    expect(formatTASON(`{ /* c */ }`).text).toBe(`{\n  /* c */\n}\n`);
    expect(formatTASON(`{} /* after */`).text).toBe(`{} /* after */\n`);
  });

  test("文件尾注释独立成块", () => {
    const result = formatTASON(`1\n\n// tail`);
    expect(result.text).toBe(`1\n\n// tail\n`);
  });

  test("注释内容零丢失（多行块注释原样）", () => {
    const block = [
      `/*`,
      ` * 第一行`,
      ` *   缩进保留`,
      ` *`,
      ` */`,
    ].join("\n");
    const result = formatTASON(`{ a: 1 }`);
    expect(result.diagnostics).toEqual([]);
    // 块注释内容作为 leading 挂在根值前；列差为 0，内部文本不改
    const withComment = formatTASON(`${block}\n{ a: 1 }`);
    expect(withComment.text).toBe(`${block}\n{ a: 1 }\n`);
  });

  test("多行块注释随元素缩进整体平移", () => {
    const src = [
      "{",
      "    /*",
      "     * 第一行",
      "     *   缩进保留",
      "     *",
      "     */",
      "    a: 1,",
      "}",
    ].join("\n");
    const expected = [
      "{",
      "  /*",
      "   * 第一行",
      "   *   缩进保留",
      "   *",
      "   */",
      "  a: 1,",
      "}",
      "",
    ].join("\n");
    const once = formatTASON(src, { tabWidth: 2, optimizeBlockComments: true });
    expect(once.text).toBe(expected);
    expect(formatTASON(once.text, { tabWidth: 2 }).text).toBe(once.text);
  });

  test("加大缩进时块注释同样右移", () => {
    const src = [
      "{",
      "  /*",
      "   * 说明",
      "  */",
      "  a: 1,",
      "}",
    ].join("\n");
    const expected = [
      "{",
      "    /*",
      "     * 说明",
      "    */",
      "    a: 1,",
      "}",
      "",
    ].join("\n");
    const once = formatTASON(src, { tabWidth: 4 });
    expect(once.text).toBe(expected);
    expect(formatTASON(once.text, { tabWidth: 4 }).text).toBe(once.text);
  });

  test("单独行注释随元素缩进", () => {
    const src = [
      "{",
      "    // 说明",
      "    a: 1,",
      "    b: [",
      "        // 元素",
      "        2,",
      "    ],",
      "}",
    ].join("\n");
    expect(formatTASON(src, { tabWidth: 2 }).text).toBe(
      [
        "{",
        "  // 说明",
        "  a: 1,",
        "  b: [",
        "    // 元素",
        "    2,",
        "  ],",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("块注释续行相对位置保留", () => {
    const src = [
      "{",
      "    /*",
      "*flush",
      "        deeper",
      "    */",
      "    a: 1,",
      "}",
    ].join("\n");
    const once = formatTASON(src, { tabWidth: 2 });
    expect(once.text).toBe(
      [
        "{",
        "  /*",
        "*flush",
        "      deeper",
        "  */",
        "  a: 1,",
        "}",
        "",
      ].join("\n"),
    );
    expect(formatTASON(once.text, { tabWidth: 2 }).text).toBe(once.text);
  });

  test("dangling 多行块注释按容器内层缩进平移", () => {
    const src = [
      "{",
      "    a: 1,",
      "    /*",
      "     * tail",
      "    */",
      "}",
    ].join("\n");
    expect(formatTASON(src, { tabWidth: 2 }).text).toBe(
      [
        "{",
        "  a: 1,",
        "  /*",
        "   * tail",
        "  */",
        "}",
        "",
      ].join("\n"),
    );
  });

  test("改用 tab 时多行块注释按列跟随", () => {
    const src = [
      "{",
      "    /*",
      "     * 说明",
      "    */",
      "    a: 1,",
      "}",
    ].join("\n");
    // 一个宽 4 的 tab 与原来的 4 空格同列，续行保持原有空格
    const same = formatTASON(src, { useTabs: true, tabWidth: 4 });
    expect(same.text).toBe(
      ["{", "\t/*", "     * 说明", "    */", "\ta: 1,", "}", ""].join("\n"),
    );
    expect(formatTASON(same.text, { useTabs: true, tabWidth: 4 }).text).toBe(same.text);

    // 目标列 2，续行左移 2；3 列写成一个 tab 再加一个空格
    const narrower = formatTASON(src, { useTabs: true, tabWidth: 2 });
    expect(narrower.text).toBe(
      ["{", "\t/*", "\t * 说明", "\t*/", "\ta: 1,", "}", ""].join("\n"),
    );
    expect(formatTASON(narrower.text, { useTabs: true, tabWidth: 2 }).text).toBe(narrower.text);
  });

  test("行末多行块注释的续行跟着定界符", () => {
    // 源文 /* 在列 10；缩进改成 2 后落在列 8，续行同步左移 2 列
    const src = [
      "{",
      "    a: 1, /* line1",
      " ".repeat(14) + "line2",
      " ".repeat(10) + "*/",
      "}",
    ].join("\n");
    const once = formatTASON(src, { tabWidth: 2 });
    expect(once.text).toBe(
      [
        "{",
        "  a: 1, /* line1",
        " ".repeat(12) + "line2",
        " ".repeat(8) + "*/",
        "}",
        "",
      ].join("\n"),
    );
    expect(formatTASON(once.text, { tabWidth: 2 }).text).toBe(once.text);
  });
});

describe("formatter 边界：尾随逗号（prettier 语义）", () => {
  test("平铺移除、展开添加", () => {
    expect(formatTASON(`[1, 2,]`).text).toBe(`[1, 2]\n`);
    expect(formatTASON(`{ a: 1, b: 2, }`).text).toBe(`{ a: 1, b: 2 }\n`);
    expect(formatTASON(`[111, 222]`, { printWidth: 8 }).text).toBe(
      ["[", "  111,", "  222,", "]", ""].join("\n"),
    );
    expect(formatTASON(`{ aaa: 1 }`, { printWidth: 8 }).text).toBe(
      ["{", "  aaa: 1,", "}", ""].join("\n"),
    );
  });

  test("trailingComma none 展开也不加", () => {
    expect(formatTASON(`[111, 222,]`, { printWidth: 8, trailingComma: "none" }).text).toBe(
      ["[", "  111,", "  222", "]", ""].join("\n"),
    );
  });

  test("单元素与空容器", () => {
    expect(formatTASON(`[1111111,]`, { printWidth: 6 }).text).toBe(
      ["[", "  1111111,", "]", ""].join("\n"),
    );
    expect(formatTASON(`[,]`).diagnostics.length).toBeGreaterThan(0);
  });
});

describe("formatter 边界：字符串转义", () => {
  test("emoji（> U+FFFF）不损坏", () => {
    expect(formatTASON(`{ e: "😀" }`).text).toBe(`{ e: "😀" }\n`);
    // 转义写法的代理对解码为同一字符串 → 原样输出 emoji
    expect(formatTASON(`{ e: "\\ud83d\\ude00" }`).text).toBe(`{ e: "😀" }\n`);
    const serializer = new TASON.Serializer();
    expect(serializer.parse(`{ e: "\\ud83d\\ude00" }`)).toEqual({ e: "😀" });
  });

  test("未配对代理项转义输出（保证合法 Unicode）", () => {
    const result = formatTASON(`{ l: "\\ud800" }`);
    expect(result.text).toBe(`{ l: "\\ud800" }\n`);
    const serializer = new TASON.Serializer();
    expect(serializer.parse(result.text)).toEqual({ l: "\ud800" });
    // 高位代理后跟普通字符（非低位代理）同样转义
    expect(formatTASON(`{ l: "\\ud83dx" }`).text).toBe(`{ l: "\\ud83dx" }\n`);
  });

  test("多重反斜杠不损坏", () => {
    // 值是 反斜杠+n（两个字符），不是换行
    expect(formatTASON(`{ s: "\\\\n" }`).text).toBe(`{ s: "\\\\n" }\n`);
    // 值是单个反斜杠
    expect(formatTASON(`{ s: "\\\\" }`).text).toBe(`{ s: "\\\\" }\n`);
    // ESC 不区分定界符：双引号串里的 \' 解码为 ' 本身；重转义只按目标引号做必要转义
    expect(formatTASON(`{ s: "\\'" }`).text).toBe(`{ s: "'" }\n`);
    expect(formatTASON(`{ s: "\\'" }`, { singleQuote: true }).text).toBe(`{ s: '\\'' }\n`);
  });

  test("字符串内嵌套两种引号", () => {
    const src = `{ a: "x'y", b: 'x"y' }`;
    expect(formatTASON(src).text).toBe(`{ a: "x'y", b: "x\\"y" }\n`);
    expect(formatTASON(src, { singleQuote: true }).text).toBe(`{ a: 'x\\'y', b: 'x"y' }\n`);
  });

  test("混合：emoji + 转义 + 控制字符", () => {
    expect(formatTASON(`{ m: "😀\\n\\u0001" }`).text).toBe(`{ m: "😀\\n\\x01" }\n`);
  });
});

describe("formatter 自动检测", () => {
  test("singleQuote auto 按多数", () => {
    expect(formatTASON(`{ a: 'x', b: 'y', c: "z" }`, { singleQuote: "auto" }).text).toBe(
      `{ a: 'x', b: 'y', c: 'z' }\n`,
    );
    expect(formatTASON(`{ a: 'x', b: "y" }`, { singleQuote: "auto" }).text).toBe(
      `{ a: "x", b: "y" }\n`,
    );
  });

  test("tabWidth auto 检测 4 并在输出上稳定", () => {
    const src = [
      `{`,
      `    a: 1,`,
      `    b: [`,
      `        2,`,
      `    ],`,
      `}`,
    ].join("\n");
    // 根对象超宽展开；[2] 作为独立 group 自身列宽内 → 平铺
    const first = formatTASON(src, { tabWidth: "auto", printWidth: 10 });
    expect(first.text).toBe(
      [
        `{`,
        `    a: 1,`,
        `    b: [2],`,
        `}`,
        ``,
      ].join("\n"),
    );
    // 输出重跑检测结论不变（平手取较大 w）
    const second = formatTASON(first.text, { tabWidth: "auto", printWidth: 10 });
    expect(second.text).toBe(first.text);
  });

  test("useTabs auto 检测 tab", () => {
    const src = `{\n\ta: 1,\n\tb: [\n\t\t2,\n\t],\n}`;
    const result = formatTASON(src, { useTabs: "auto", printWidth: 10 });
    expect(result.text).toBe(`{\n\ta: 1,\n\tb: [2],\n}\n`);
  });
});

describe("formatter 不变量", () => {
  test("幂等（默认与 auto 选项）", () => {
    const commentFixture = [
      `// head`,
      `{ a: 1, // t`,
      `  /* dangling */`,
      `}`,
      `// tail`,
    ].join("\n");
    const sources = [...FIXTURES, commentFixture];
    const optionSets = [
      {},
      { printWidth: 10 },
      { printWidth: 120, singleQuote: true, quoteKeys: "preserve" as const },
      { tabWidth: "auto" as const, useTabs: "auto" as const, singleQuote: "auto" as const, printWidth: 16 },
      { trailingComma: "none" as const, printWidth: 8 },
    ];
    for (const source of sources) {
      for (const options of optionSets) {
        const once = formatTASON(source, options);
        expect(once.diagnostics).toEqual([]);
        const twice = formatTASON(once.text, options);
        expect(twice.text).toBe(once.text);
      }
    }
  });

  test("语义保真（parse(format(x)) ≡ parse(x)）", () => {
    const serializer = new TASON.Serializer();
    for (const source of FIXTURES) {
      const result = formatTASON(source);
      expect(serializer.parse(result.text)).toEqual(serializer.parse(source));
    }
  });

  test("注释零丢失", () => {
    const src = [
      `/*头*/ {`,
      `  a: 1, // a`,
      `  /* b */ b: 'x', /* after b */`,
      `  c: [/* in */ 1],`,
      `} /* end */`,
    ].join("\n");
    const result = formatTASON(src);
    const comments = result.text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) ?? [];
    expect(comments).toEqual(["/*头*/", "// a", "/* b */", "/* after b */", "/* in */", "/* end */"]);
  });
});

describe("formatter 严格模式", () => {
  test("语法错误原样返回并带诊断", () => {
    for (const bad of ["{,}", "{ a: 1, b: }", "{true: 1}", "[1, 2", "{ a: ! }"]) {
      const result = formatTASON(bad);
      expect(result.text).toBe(bad);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });
});
