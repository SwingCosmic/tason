// 内部工具：只跑 lexer，取完整 token 序（含 HIDDEN 通道注释与 EOF）。
// 供注释归属判定使用（§3.4 依据 token 相对位置），不构造 parser。

import { CharStreams, CommonTokenStream, Token } from "antlr4";
import TASONLexer from "../grammar/TASONLexer";

export function tokenize(text: string): Token[] {
  const chars = CharStreams.fromString(text);
  const lexer = new TASONLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  tokens.fill();
  return tokens.tokens;
}
