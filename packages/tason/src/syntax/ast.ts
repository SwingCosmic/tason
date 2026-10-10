// TASON 语法层 AST 节点模型（docs/features/formatter/design.md §2.2）。
//
// 命名对齐 Babel（@babel/parser）并简化：
// - `type` 字段判别（estree 惯例），`start` / `end` 为半开区间字符偏移；
// - 字面量带 `raw`（原文形态）；NumericLiteral 不求值，符号在 `sign`；
// - `TypeInstance` 为 TASON 独有节点，argument 即普通子节点；
// - 注释是独立小节点（CommentBlock / CommentLine），不附着到值节点上。

export type TASONExpression =
  | ObjectExpression
  | ArrayExpression
  | StringLiteral
  | NumericLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | TypeInstance;

export interface ObjectExpression {
  type: "ObjectExpression";
  start: number;
  end: number;
  properties: ObjectProperty[];
}

export interface ObjectProperty {
  type: "ObjectProperty";
  start: number;
  end: number;
  /** 裸 key → Identifier；带引号 key → StringLiteral */
  key: Identifier | StringLiteral;
  value: TASONExpression;
}

export interface ArrayExpression {
  type: "ArrayExpression";
  start: number;
  end: number;
  elements: TASONExpression[];
}

export interface StringLiteral {
  type: "StringLiteral";
  start: number;
  end: number;
  /** 解码后的字符串值 */
  value: string;
  /** 原文形态，含定界引号；raw[0] 即引号字符 */
  raw: string;
}

export interface NumericLiteral {
  type: "NumericLiteral";
  start: number;
  end: number;
  /** number 规则的 SYMBOL?，NaN / Infinity 前的符号同此 */
  sign?: "+" | "-";
  /** NUMBER / 'NaN' / 'Infinity' token 原文（进制、指数形态），不含符号 */
  raw: string;
}

export interface BooleanLiteral {
  type: "BooleanLiteral";
  start: number;
  end: number;
  value: boolean;
}

export interface NullLiteral {
  type: "NullLiteral";
  start: number;
  end: number;
}

export interface Identifier {
  type: "Identifier";
  start: number;
  end: number;
  name: string;
}

/** TypeName(arg)：ScalarTypeInstance / ObjectTypeInstance 的共同形态 */
export interface TypeInstance {
  type: "TypeInstance";
  start: number;
  end: number;
  /** 类型名（TASON 规范表述） */
  typeName: Identifier;
  /** scalar 形态 → StringLiteral；object 形态 → ObjectExpression */
  argument: StringLiteral | ObjectExpression;
}

export type TASONComment = CommentBlock | CommentLine;

/** 块注释：value 为剥掉两端定界符后的内部文本（JSDoc 的第二个 * 属于 value） */
export interface CommentBlock {
  type: "CommentBlock";
  start: number;
  end: number;
  value: string;
}

/** 行注释：value 为剥掉 // 后的文本（含前导空格） */
export interface CommentLine {
  type: "CommentLine";
  start: number;
  end: number;
  value: string;
}
