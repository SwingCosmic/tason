// 打印器（design.md §3.2 / §3.4）：从 AST + 注释归属 + 选项整体重生成输出。
// MVP 为递归 + 「平铺测宽、放不下则展开」的二态 group 判定，不引入完整 doc algebra。

import * as AST from "../ast";
import { quoteString } from "../stringEscape";
import type { ResolvedFormatOptions } from "./options";
import type { AnchorNode, AttachedComment, CommentAttachment } from "./comments";

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// 裸写会直接语法错误的保留字（§3.3.4，宁多勿少）：
// true/false/null 有先于 IDENTIFIER 的 lexer 规则；NaN/Infinity 是 parser 字面量引用的隐式 token
const BARE_KEYWORD_BLACKLIST = new Set(["true", "false", "null", "NaN", "Infinity"]);

export class Printer {
  private readonly eol: string;
  private readonly quote: '"' | "'";

  constructor(
    private readonly options: ResolvedFormatOptions,
    private readonly attachment: CommentAttachment,
    /** 原文，用来量注释定界符的起始列（续行按列差整体平移） */
    private readonly source: string,
  ) {
    this.eol = options.endOfLine === "crlf" ? "\r\n" : "\n";
    this.quote = options.singleQuote ? "'" : '"';
  }

  format(root: AST.TASONExpression): string {
    const out: string[] = [];
    // 根值的前导注释 = 文件首块
    this.emitCommentLines(this.attachment.leading.get(root) ?? [], 0, out);
    this.emitValue(root, "", 0, out, "");
    this.appendTrailing(out, this.attachment.trailing.get(root));
    for (const item of this.attachment.fileTail) {
      if (item.blankBefore && out.length > 0) out.push("");
      out.push(this.renderCommentBody(item.comment, 0));
    }
    return out.join(this.eol) + this.eol;
  }

  // ---- 行构建 ----

  private indentStr(level: number): string {
    return this.options.useTabs
      ? "\t".repeat(level)
      : " ".repeat(level * this.options.tabWidth);
  }

  /** 视觉宽度：tab 按 tabWidth 计 */
  private visualWidth(s: string): number {
    let width = 0;
    for (const ch of s) {
      width += ch === "\t" ? this.options.tabWidth : 1;
    }
    return width;
  }

  private commentBody(comment: AST.TASONComment): string {
    return comment.type === "CommentBlock"
      ? "/*" + comment.value + "*/"
      : "//" + comment.value;
  }

  /**
   * 把注释整体平移，使定界符落在 targetColumn。
   * 续行按同一列差移动，行间相对缩进保留；只改行首空白，不重排文字。
   * 返回值的首行不含缩进，调用方负责把首行接到宽度恰好为 targetColumn 的前缀后。
   */
  private renderCommentBody(comment: AST.TASONComment, targetColumn: number): string {
    const body = this.commentBody(comment);
    if (!/[\n\r]/.test(body)) return body;

    const delta = targetColumn - this.columnAt(comment.start);
    const lines = body.split(/\r\n|\n|\r/);
    const shifted = lines.map((line, index) => {
      if (index === 0 || delta === 0 || line.length === 0) return line;
      return this.shiftIndent(line, delta);
    });
    return shifted.join(this.eol);
  }

  /** 注释定界符在原文中的起始列（tab 按 tabWidth 计） */
  private columnAt(offset: number): number {
    let i = offset;
    while (i > 0) {
      const ch = this.source[i - 1];
      if (ch === "\n" || ch === "\r") break;
      i--;
    }
    return this.visualWidth(this.source.slice(i, offset));
  }

  /** 行首空白按列差增减；不够减时停在列 0，不吃进文字 */
  private shiftIndent(line: string, delta: number): string {
    let columns = 0;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === " ") {
        columns += 1;
        i++;
      } else if (ch === "\t") {
        columns += this.options.tabWidth;
        i++;
      } else {
        break;
      }
    }
    const next = Math.max(0, columns + delta);
    if (next === columns) return line;
    return this.indentColumns(next) + line.slice(i);
  }

  private indentColumns(columns: number): string {
    if (this.options.useTabs) {
      const tabs = Math.floor(columns / this.options.tabWidth);
      const spaces = columns % this.options.tabWidth;
      return "\t".repeat(tabs) + " ".repeat(spaces);
    }
    return " ".repeat(columns);
  }

  private lastLineWidth(text: string): number {
    const nl = text.lastIndexOf("\n");
    const cr = text.lastIndexOf("\r");
    const cut = Math.max(nl, cr);
    return this.visualWidth(cut < 0 ? text : text.slice(cut + 1));
  }

  private emitCommentLines(items: AttachedComment[], indent: number, out: string[]): void {
    const prefix = this.indentStr(indent);
    const column = this.visualWidth(prefix);
    for (const item of items) {
      if (item.blankBefore && out.length > 0) out.push("");
      out.push(prefix + this.renderCommentBody(item.comment, column));
    }
    if (items.length > 0 && out.length > 0 && items[items.length - 1].blankAfter) {
      out.push("");
    }
  }

  /** 行末注释：块注释前一空格、行注释前两空格；块在前、行在后（行注释必须最后，否则吞掉后续内容） */
  private appendTrailing(out: string[], items: AttachedComment[] | undefined): void {
    if (!items || items.length === 0) return;
    let line = out[out.length - 1];
    for (const item of items) {
      if (item.comment.type !== "CommentBlock") continue;
      const targetColumn = this.lastLineWidth(line) + 1;
      line += " " + this.renderCommentBody(item.comment, targetColumn);
    }
    for (const item of items) {
      if (item.comment.type !== "CommentLine") continue;
      const targetColumn = this.lastLineWidth(line) + 2;
      line += "  " + this.renderCommentBody(item.comment, targetColumn);
    }
    out[out.length - 1] = line;
  }

  private keyText(key: AST.Identifier | AST.StringLiteral): string {
    if (key.type === "Identifier") return key.name;
    if (this.options.quoteKeys === "preserve") {
      return quoteString(key.value, this.quote);
    }
    if (IDENTIFIER_PATTERN.test(key.value) && !BARE_KEYWORD_BLACKLIST.has(key.value)) {
      return key.value;
    }
    return quoteString(key.value, this.quote);
  }

  // ---- 展开（多行）输出 ----

  private emitValue(
    node: AST.TASONExpression,
    prefix: string,
    indent: number,
    out: string[],
    suffix: string,
  ): void {
    const flat = this.tryFlat(node, this.visualWidth(prefix));
    if (flat !== null) {
      out.push(prefix + flat + suffix);
      return;
    }
    this.emitExpanded(node, prefix, indent, out, suffix);
  }

  private emitExpanded(
    node: AST.TASONExpression,
    prefix: string,
    indent: number,
    out: string[],
    suffix: string,
  ): void {
    switch (node.type) {
      case "ObjectExpression":
        this.emitExpandedObject(node, prefix + "{", indent, out, suffix, "}");
        break;
      case "ArrayExpression":
        this.emitExpandedArray(node, prefix, indent, out, suffix);
        break;
      case "TypeInstance":
        this.emitExpandedTypeInstance(node, prefix, indent, out, suffix);
        break;
      default:
        // 标量总能平铺，理论不可达
        out.push(prefix + this.scalarText(node) + suffix);
        break;
    }
  }

  private emitExpandedObject(
    node: AST.ObjectExpression,
    openLine: string,
    indent: number,
    out: string[],
    suffix: string,
    closeText: string,
  ): void {
    out.push(openLine);
    const inner = indent + 1;
    const last = node.properties.length - 1;
    node.properties.forEach((property, i) => {
      const comma = i === last
        ? (this.options.trailingComma === "all" ? "," : "")
        : ",";
      this.emitProperty(property, inner, out, comma);
    });
    this.emitCommentLines(this.attachment.dangling.get(node) ?? [], inner, out);
    out.push(this.indentStr(indent) + closeText + suffix);
  }

  private emitExpandedArray(
    node: AST.ArrayExpression,
    prefix: string,
    indent: number,
    out: string[],
    suffix: string,
  ): void {
    out.push(prefix + "[");
    const inner = indent + 1;
    const last = node.elements.length - 1;
    node.elements.forEach((element, i) => {
      const comma = i === last
        ? (this.options.trailingComma === "all" ? "," : "")
        : ",";
      this.emitArrayElement(element, inner, out, comma);
    });
    this.emitCommentLines(this.attachment.dangling.get(node) ?? [], inner, out);
    out.push(this.indentStr(indent) + "]" + suffix);
  }

  private emitExpandedTypeInstance(
    node: AST.TypeInstance,
    prefix: string,
    indent: number,
    out: string[],
    suffix: string,
  ): void {
    const name = node.typeName.name;
    const argumentLeading = this.attachment.leading.get(node.argument) ?? [];
    if (node.argument.type === "ObjectExpression" && argumentLeading.length === 0) {
      // 形态 A：Name({
      //   …
      // })
      this.emitExpandedObject(node.argument, prefix + name + "({", indent, out, suffix, "})");
      this.appendTrailing(out, this.attachment.trailing.get(node.argument));
      return;
    }
    // 形态 B：参数自带前导注释（或 scalar 参数被注释撑开），参数独立成块
    out.push(prefix + name + "(");
    const inner = indent + 1;
    this.emitCommentLines(argumentLeading, inner, out);
    this.emitValue(node.argument, this.indentStr(inner), inner, out, "");
    this.appendTrailing(out, this.attachment.trailing.get(node.argument));
    this.emitCommentLines(this.attachment.dangling.get(node) ?? [], inner, out);
    out.push(this.indentStr(indent) + ")" + suffix);
  }

  private emitProperty(
    property: AST.ObjectProperty,
    indent: number,
    out: string[],
    suffix: string,
  ): void {
    this.emitCommentLines(this.attachment.leading.get(property) ?? [], indent, out);
    const line = this.indentStr(indent) + this.keyText(property.key) + ": ";
    this.emitValue(property.value, line, indent, out, suffix);
    this.appendTrailing(out, this.attachment.trailing.get(property));
  }

  private emitArrayElement(
    element: AST.TASONExpression,
    indent: number,
    out: string[],
    suffix: string,
  ): void {
    this.emitCommentLines(this.attachment.leading.get(element) ?? [], indent, out);
    this.emitValue(element, this.indentStr(indent), indent, out, suffix);
    this.appendTrailing(out, this.attachment.trailing.get(element));
  }

  // ---- 平铺输出（返回 null 表示当前列放下下 / 被注释强制展开） ----

  private scalarText(node: AST.TASONExpression): string {
    switch (node.type) {
      case "StringLiteral": return quoteString(node.value, this.quote);
      case "NumericLiteral": return (node.sign ?? "") + node.raw;
      case "BooleanLiteral": return node.value ? "true" : "false";
      case "NullLiteral": return "null";
      case "Identifier": return node.name;
      default: return "";
    }
  }

  private tryFlat(node: AST.TASONExpression, col: number): string | null {
    switch (node.type) {
      case "StringLiteral":
      case "NumericLiteral":
      case "BooleanLiteral":
      case "NullLiteral":
      case "Identifier":
        return this.scalarText(node);
      case "ObjectExpression":
        return this.tryFlatObject(node, col);
      case "ArrayExpression":
        return this.tryFlatArray(node, col);
      case "TypeInstance":
        return this.tryFlatTypeInstance(node, col);
    }
  }

  /** 行末块注释的平铺追加（行注释在外层已判 null） */
  private flatTrailing(anchor: AnchorNode): string {
    const items = this.attachment.trailing.get(anchor);
    if (!items) return "";
    let suffix = "";
    for (const item of items) {
      if (item.comment.type === "CommentBlock") {
        suffix += " /*" + item.comment.value + "*/";
      }
    }
    return suffix;
  }

  private hasLeadingComments(anchor: AnchorNode): boolean {
    return (this.attachment.leading.get(anchor)?.length ?? 0) > 0;
  }

  /** 行注释，或值里含换行的块注释：不能塞进平铺行 */
  private hasBreakTrailing(anchor: AnchorNode): boolean {
    const items = this.attachment.trailing.get(anchor);
    return items != null && items.some((item) =>
      item.comment.type === "CommentLine" || /[\r\n]/.test(item.comment.value),
    );
  }

  private tryFlatObject(node: AST.ObjectExpression, col: number): string | null {
    if ((this.attachment.dangling.get(node)?.length ?? 0) > 0) return null;
    if (node.properties.length === 0) return "{}";
    const parts: string[] = [];
    let lineLength = col + 2; // "{ "
    for (const property of node.properties) {
      if (this.hasLeadingComments(property)) return null;
      if (this.hasBreakTrailing(property)) return null;
      const key = this.keyText(property.key);
      const valueFlat = this.tryFlat(property.value, lineLength + key.length + 2);
      if (valueFlat === null) return null;
      const part = key + ": " + valueFlat + this.flatTrailing(property);
      parts.push(part);
      lineLength += part.length + 2; // ", "
    }
    const s = "{ " + parts.join(", ") + " }";
    if (col + s.length > this.options.printWidth) return null;
    return s;
  }

  private tryFlatArray(node: AST.ArrayExpression, col: number): string | null {
    if ((this.attachment.dangling.get(node)?.length ?? 0) > 0) return null;
    if (node.elements.length === 0) return "[]";
    const parts: string[] = [];
    let lineLength = col + 1; // "["
    for (const element of node.elements) {
      if (this.hasLeadingComments(element)) return null;
      if (this.hasBreakTrailing(element)) return null;
      const elementFlat = this.tryFlat(element, lineLength);
      if (elementFlat === null) return null;
      const part = elementFlat + this.flatTrailing(element);
      parts.push(part);
      lineLength += part.length + 2; // ", "
    }
    const s = "[" + parts.join(", ") + "]";
    if (col + s.length > this.options.printWidth) return null;
    return s;
  }

  private tryFlatTypeInstance(node: AST.TypeInstance, col: number): string | null {
    if ((this.attachment.dangling.get(node)?.length ?? 0) > 0) return null;
    const argument = node.argument;
    if (this.hasLeadingComments(argument)) return null;
    if (this.hasBreakTrailing(argument)) return null;
    const name = node.typeName.name;
    const argumentFlat = this.tryFlat(argument, col + name.length + 1);
    if (argumentFlat === null) return null;
    const s = name + "(" + argumentFlat + this.flatTrailing(argument) + ")";
    if (col + s.length > this.options.printWidth) return null;
    return s;
  }
}
