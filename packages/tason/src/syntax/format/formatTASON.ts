// 格式化入口（design.md §3 / §3.5）。
// 首版仅严格模式：diagnostics 非空即原样返回输入文本，不暴露 errorTolerance；
// 三个 optimize* 选项预留但不实现（resolveFormatOptions 不读取，一律视为 false）。

import { parseSyntax } from "../parseSyntax";
import { tokenize } from "../tokenize";
import { attachComments } from "./comments";
import { resolveFormatOptions } from "./detect";
import type { FormatResult, TASONFormatOptions } from "./options";
import { Printer } from "./printer";

export function formatTASON(text: string, options?: TASONFormatOptions): FormatResult {
  const result = parseSyntax(text);
  if (result.diagnostics.length > 0 || result.ast == null) {
    return { text, diagnostics: result.diagnostics };
  }

  const resolved = resolveFormatOptions(text, result.ast, options);
  const attachment = attachComments(text, result.ast, tokenize(text));
  const printer = new Printer(resolved, attachment);
  return { text: printer.format(result.ast), diagnostics: [] };
}
