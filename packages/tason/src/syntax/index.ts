// tason/syntax 子入口（design.md §4）。
// 模块图只含语法层与格式化器，不 import Registry、types/、schema/、metadata/。
// 插件不用本入口：.tasonrc 直读需要值级 TASON.parse，走主入口。

export { parseSyntax } from "./parseSyntax";
export type { SyntaxDiagnostic, SyntaxParseResult } from "./parseSyntax";

export { formatTASON } from "./format/formatTASON";
export type { FormatResult, TASONFormatOptions } from "./format/options";

export type {
  ArrayExpression,
  BooleanLiteral,
  CommentBlock,
  CommentLine,
  Identifier,
  NullLiteral,
  NumericLiteral,
  ObjectExpression,
  ObjectProperty,
  StringLiteral,
  TASONComment,
  TASONExpression,
  TypeInstance,
} from "./ast";
