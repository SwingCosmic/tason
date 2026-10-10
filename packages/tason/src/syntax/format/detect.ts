// "auto" 选项的确定性检测（design.md §3.3.3）。
// 全部只依赖源文统计量，输出风格统一后重跑结论不变（幂等依据，§3.1 第 5 条）。

import type * as AST from "../ast";
import type { ResolvedFormatOptions } from "./options";

/** 统计源文全部 STRING 的引号字符，按字面量个数严格多数定单引号 */
export function detectSingleQuote(ast: AST.TASONExpression): boolean {
  let single = 0;
  let double = 0;
  const visit = (node: AST.TASONExpression | AST.ObjectProperty | AST.StringLiteral | AST.Identifier): void => {
    switch (node.type) {
      case "StringLiteral":
        if (node.raw[0] === "'") single++;
        else double++;
        break;
      case "ObjectProperty":
        visit(node.key);
        visit(node.value);
        break;
      case "ObjectExpression":
        node.properties.forEach(visit);
        break;
      case "ArrayExpression":
        node.elements.forEach(visit);
        break;
      case "TypeInstance":
        visit(node.argument);
        break;
    }
  };
  visit(ast);
  return single > double;
}

/** 有前导缩进的行（注释行计入）：tab 起头 vs 空格起头，多数获胜 */
export function detectUseTabs(text: string): boolean {
  let tabs = 0;
  let spaces = 0;
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    const first = line[0];
    if (first === "\t") {
      // 全空白行不算「有前导缩进的行」
      if (line.trim().length > 0) tabs++;
    } else if (first === " ") {
      if (line.trim().length > 0) spaces++;
    }
  }
  return tabs > spaces;
}

const TAB_WIDTH_CANDIDATES = [8, 6, 4, 2, 1];

/** 候选 {1,2,4,6,8}；支持度 =「前导空格数为 w 的正整数倍」的行数；取最高，平手取较大 w */
export function detectTabWidth(text: string): number {
  const indents: number[] = [];
  for (const line of text.split("\n")) {
    if (line[0] !== " ") continue;
    if (line.trim().length === 0) continue;
    let width = 0;
    while (line[width] === " ") width++;
    indents.push(width);
  }
  if (indents.length === 0) return 2;

  let best = 2;
  let bestSupport = -1;
  for (const w of TAB_WIDTH_CANDIDATES) {
    const support = indents.filter((n) => n > 0 && n % w === 0).length;
    // 候选从大到小遍历，严格大于才替换 → 平手保留较大 w
    if (support > bestSupport) {
      bestSupport = support;
      best = w;
    }
  }
  return best;
}

export function resolveFormatOptions(
  text: string,
  ast: AST.TASONExpression,
  options?: import("./options").TASONFormatOptions,
): ResolvedFormatOptions {
  return {
    tabWidth: options?.tabWidth === "auto" ? detectTabWidth(text) : options?.tabWidth ?? 2,
    useTabs: options?.useTabs === "auto" ? detectUseTabs(text) : options?.useTabs ?? false,
    printWidth: options?.printWidth ?? 80,
    singleQuote: options?.singleQuote === "auto" ? detectSingleQuote(ast) : options?.singleQuote ?? false,
    quoteKeys: options?.quoteKeys ?? "as-needed",
    trailingComma: options?.trailingComma ?? "all",
    endOfLine: options?.endOfLine ?? "lf",
  };
}
