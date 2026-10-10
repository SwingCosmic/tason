// 格式化选项（design.md §3.3.1，命名对齐 Prettier）。
// 首版范围：三个 optimize* 选项预留但不实现——传入 true 一律按 false 处理，
// 解析层根本不读取它们。

export interface TASONFormatOptions {
  /** 缩进宽度；默认 2。"auto" 检测原文档缩进单元 */
  tabWidth?: number | "auto";
  /** 是否用 tab 缩进；默认 false（空格）。 */
  useTabs?: boolean | "auto";
  /** 单行宽度上限；默认 80 */
  printWidth?: number;
  /** 字符串用单引号；默认 false（双引号）。 */
  singleQuote?: boolean | "auto";
  /** object key 尽可能去引号；默认 "as-needed" */
  quoteKeys?: "as-needed" | "preserve";
  /** 多行容器尾逗号；默认 "all"（添加） */
  trailingComma?: "all" | "none";
  /** 数值字面量等值规范化；默认 false（原样输出）。首版不实现，传 true 视为 false */
  optimizeNumbers?: boolean;
  /** 数值优化扩展到内置数值 TypeName 的 Scalar 参数字符串；默认 false。
   *  仅在 optimizeNumbers 开启时生效。首版不实现，传 true 视为 false */
  optimizeNumberTypeInstances?: boolean;
  /** 块注释按 JS 风格规范化；默认 false（注释原样搬运）。首版不实现，传 true 视为 false */
  optimizeBlockComments?: boolean;
  /** 换行符；默认 "lf"。插件侧传文档 EOL */
  endOfLine?: "lf" | "crlf";
}

export interface FormatResult {
  /** diagnostics 非空时 === 输入原文（严格模式） */
  text: string;
  diagnostics: import("../parseSyntax").SyntaxDiagnostic[];
}

/** 检测与默认值全部落实后的选项 */
export interface ResolvedFormatOptions {
  tabWidth: number;
  useTabs: boolean;
  printWidth: number;
  singleQuote: boolean;
  quoteKeys: "as-needed" | "preserve";
  trailingComma: "all" | "none";
  endOfLine: "lf" | "crlf";
}
