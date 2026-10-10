// 语法层解析（design.md §2.3）：不依赖 Registry / 值级实现的纯 AST + 诊断入口。
// 与 TASONSerializer.parse 并列；未注册 / 不存在的 TypeName 在此层一律合法。

import {
  CharStreams,
  CommonTokenStream,
  ErrorListener,
  RecognitionException,
  Token,
} from "antlr4";
import TASONLexer from "../grammar/TASONLexer";
import TASONParser from "../grammar/TASONParser";
import {
  ArrayContext,
  ArrayValueContext,
  BooleanValueContext,
  IdentifierContext,
  NumberContext,
  NumberValueContext,
  NullValueContext,
  ObjectContext,
  ObjectTypeInstanceContext,
  ObjectValueContext,
  PairContext,
  KeyContext,
  ScalarTypeInstanceContext,
  StartContext,
  StringKeyContext,
  StringValueContext,
  TypeInstanceContext,
  TypeInstanceValueContext,
  ValueContext,
} from "../grammar/TASONParser";
import * as AST from "./ast";
import { decodeStringLiteral } from "./stringEscape";

export interface SyntaxDiagnostic {
  message: string;
  /** 字符偏移 */
  offset: number;
  /** 0-based，与 VSCode 一致 */
  line: number;
  /** 0-based */
  column: number;
}

export interface SyntaxParseResult {
  /** 完全不可解析时为 null；存在语法错误时尽力给出部分树（同时 diagnostics 非空） */
  ast: AST.TASONExpression | null;
  /** 全部行注释与块注释，按出现序 */
  comments: AST.TASONComment[];
  diagnostics: SyntaxDiagnostic[];
}

class CollectingErrorListener extends ErrorListener<any> {
  constructor(
    private readonly text: string,
    private readonly diagnostics: SyntaxDiagnostic[],
  ) {
    super();
  }

  syntaxError(
    _recognizer: any,
    offendingSymbol: any,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: RecognitionException | undefined,
  ): void {
    // ANTLR line 为 1-based
    const offset = offendingSymbol && typeof offendingSymbol.start === "number"
      ? offendingSymbol.start
      : lineColumnToOffset(this.text, line - 1, charPositionInLine);
    this.diagnostics.push({
      message: msg,
      offset,
      line: line - 1,
      column: charPositionInLine,
    });
  }
}

export function parseSyntax(text: string): SyntaxParseResult {
  const chars = CharStreams.fromString(text);
  const lexer = new TASONLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new TASONParser(tokens);

  const diagnostics: SyntaxDiagnostic[] = [];
  const listener = new CollectingErrorListener(text, diagnostics);
  lexer.removeErrorListeners();
  parser.removeErrorListeners();
  lexer.addErrorListener(listener);
  parser.addErrorListener(listener);

  let tree: StartContext;
  try {
    tree = parser.start();
    // 取完整 token 序（含 EOF 之前的尾随注释）
    tokens.fill();
  } catch (e) {
    // INVALID_CHAR 词法动作直接 throw（不经过 error listener），在入口转诊断
    if (e instanceof Error && e.message.startsWith("Invalid character")) {
      const offset = Math.max(0, lexer._input.index - 1);
      diagnostics.push(offsetToDiagnostic(text, e.message, offset));
      return { ast: null, comments: collectComments(tokens), diagnostics };
    }
    throw e;
  }

  const valueCtx = tree.value();
  const ast = valueCtx ? buildValue(valueCtx) : null;
  return { ast, comments: collectComments(tokens), diagnostics };
}

function collectComments(tokens: CommonTokenStream): AST.TASONComment[] {
  const result: AST.TASONComment[] = [];
  for (const tok of tokens.tokens) {
    if (tok.channel !== Token.HIDDEN_CHANNEL || tok.type === Token.EOF) {
      continue;
    }
    if (tok.type === TASONLexer.SINGLE_LINE_COMMENT) {
      result.push({
        type: "CommentLine",
        start: tok.start,
        end: tok.stop + 1,
        value: tok.text.slice(2),
      });
    } else if (tok.type === TASONLexer.MULTI_LINE_COMMENT) {
      result.push({
        type: "CommentBlock",
        start: tok.start,
        end: tok.stop + 1,
        value: tok.text.slice(2, -2),
      });
    }
  }
  return result;
}

/** ParserRuleContext 的起止 token → 半开区间偏移 */
function ctxRange(ctx: { start: Token; stop?: Token }): { start: number; end: number } {
  const stop = ctx.stop ?? ctx.start;
  return { start: ctx.start.start, end: stop.stop + 1 };
}

/**
 * 构建 AST。错误恢复可能产生未进入任何标量分支的 context（其子节点是
 * ErrorNode），此时返回 null 并向上传播——调用方在 diagnostics 非空的
 * 场景本就不会消费该树（严格模式直接原样返回）。
 */
function buildValue(ctx: ValueContext): AST.TASONExpression | null {
  if (ctx instanceof ObjectValueContext) {
    return buildObject(ctx.object());
  }
  if (ctx instanceof ArrayValueContext) {
    return buildArray(ctx.array());
  }
  if (ctx instanceof StringValueContext) {
    return buildStringLiteral(ctx.STRING().symbol);
  }
  if (ctx instanceof NumberValueContext) {
    return buildNumber(ctx.number_());
  }
  if (ctx instanceof BooleanValueContext) {
    const booleanCtx = ctx.boolean_();
    const isTrue = booleanCtx.BOOLEAN_TRUE() != null;
    const token = (isTrue
      ? booleanCtx.BOOLEAN_TRUE()!
      : booleanCtx.BOOLEAN_FALSE()!).symbol;
    return { type: "BooleanLiteral", start: token.start, end: token.stop + 1, value: isTrue };
  }
  if (ctx instanceof NullValueContext) {
    const token = ctx.NULL().symbol;
    return { type: "NullLiteral", start: token.start, end: token.stop + 1 };
  }
  if (ctx instanceof TypeInstanceValueContext) {
    return buildTypeInstance(ctx.typeInstance());
  }
  return null;
}

function buildObject(ctx: ObjectContext): AST.ObjectExpression | null {
  const properties: AST.ObjectProperty[] = [];
  for (const pair of ctx.pair_list()) {
    const property = buildPair(pair);
    if (property === null) return null;
    properties.push(property);
  }
  return {
    type: "ObjectExpression",
    ...ctxRange(ctx),
    properties,
  };
}

function buildPair(ctx: PairContext): AST.ObjectProperty | null {
  const value = buildValue(ctx.value());
  if (value === null) return null;
  return {
    type: "ObjectProperty",
    ...ctxRange(ctx),
    key: buildKey(ctx.key()),
    value,
  };
}

function buildKey(ctx: KeyContext): AST.Identifier | AST.StringLiteral {
  if (ctx instanceof IdentifierContext) {
    return buildIdentifier(ctx.IDENTIFIER().symbol);
  }
  if (ctx instanceof StringKeyContext) {
    return buildStringLiteral(ctx.STRING().symbol);
  }
  return buildIdentifier(ctx.start);
}

function buildArray(ctx: ArrayContext): AST.ArrayExpression | null {
  const elements: AST.TASONExpression[] = [];
  for (const value of ctx.value_list()) {
    const element = buildValue(value);
    if (element === null) return null;
    elements.push(element);
  }
  return {
    type: "ArrayExpression",
    ...ctxRange(ctx),
    elements,
  };
}

function buildStringLiteral(token: Token): AST.StringLiteral {
  return {
    type: "StringLiteral",
    start: token.start,
    end: token.stop + 1,
    value: decodeStringLiteral(token.text),
    raw: token.text,
  };
}

function buildIdentifier(token: Token): AST.Identifier {
  return {
    type: "Identifier",
    start: token.start,
    end: token.stop + 1,
    name: token.text,
  };
}

function buildNumber(ctx: NumberContext): AST.NumericLiteral {
  // number: SYMBOL? (NUMBER | 'NaN' | 'Infinity')，符号是独立 token
  const first = ctx.start;
  const last = ctx.stop ?? ctx.start;
  const sign = first.type === TASONLexer.SYMBOL
    ? first.text as "+" | "-"
    : undefined;
  const valueToken = sign !== undefined ? last : first;
  return {
    type: "NumericLiteral",
    start: first.start,
    end: last.stop + 1,
    sign,
    raw: valueToken.text,
  };
}

function buildTypeInstance(ctx: TypeInstanceContext): AST.TypeInstance | null {
  if (ctx instanceof ScalarTypeInstanceContext) {
    return {
      type: "TypeInstance",
      ...ctxRange(ctx),
      typeName: buildIdentifier(ctx.IDENTIFIER().symbol),
      argument: buildStringLiteral(ctx.STRING().symbol),
    };
  }
  if (ctx instanceof ObjectTypeInstanceContext) {
    const argument = buildObject(ctx.object());
    if (argument === null) return null;
    return {
      type: "TypeInstance",
      ...ctxRange(ctx),
      typeName: buildIdentifier(ctx.IDENTIFIER().symbol),
      argument,
    };
  }
  return null;
}

function lineColumnToOffset(text: string, line: number, column: number): number {
  let currentLine = 0;
  let offset = 0;
  while (currentLine < line && offset < text.length) {
    if (text[offset] === "\n") {
      currentLine++;
    }
    offset++;
  }
  return offset + column;
}

function offsetToDiagnostic(
  text: string,
  message: string,
  offset: number,
): SyntaxDiagnostic {
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      lastNewline = i;
    }
  }
  return { message, offset, line, column: offset - lastNewline - 1 };
}
