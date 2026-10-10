// 注释归属判定（design.md §3.4）：依据 token 相对位置与换行存在性，
// 把每条注释归入四类之一——leading / trailing / dangling / 文件首尾。
// 不引入附着模型（不做 Babel 式 leadingComments 等字段），归属结果是
// formatter 的内部输入。

import { Token } from "antlr4";
import TASONLexer from "../../grammar/TASONLexer";
import * as AST from "../ast";

/** 锚节点：root、object 属性、array 元素、TypeInstance 参数 */
export type AnchorNode = AST.ObjectProperty | AST.TASONExpression;
/** 容器节点：可展开的闭括号归属对象 */
export type ContainerNode = AST.ObjectExpression | AST.ArrayExpression | AST.TypeInstance;

interface Anchor {
  node: AnchorNode;
  parent: Anchor | null;
  firstTokenIndex: number;
  lastTokenIndex: number;
  /** TypeInstance 的 scalar（StringLiteral）参数锚：行注释不能留在括号内（会吞掉 ')'） */
  scalarArgumentOf: AST.TypeInstance | null;
}

export interface AttachedComment {
  comment: AST.TASONComment;
  /** 输出时与前一内容之间补一个空行（源文有 ≥ 1 个空行） */
  blankBefore: boolean;
  /** 与后一内容之间补一个空行（仅 leading 组最后一个 / dangling 组最后一个使用） */
  blankAfter: boolean;
}

export interface CommentAttachment {
  /** 元素前导注释（own-line；根值的前导即文件首块） */
  leading: Map<AnchorNode, AttachedComment[]>;
  /** 元素行末注释（块注释前一空格，行注释前两空格） */
  trailing: Map<AnchorNode, AttachedComment[]>;
  /** 容器闭括号前注释（own-line，含空容器场景） */
  dangling: Map<ContainerNode, AttachedComment[]>;
  /** 根值之后（文件尾）的注释 */
  fileTail: AttachedComment[];
}

function countNewlines(text: string, from: number, to: number): number {
  let count = 0;
  for (let i = from; i < to && i < text.length; i++) {
    if (text[i] === "\n") count++;
  }
  return count;
}

export function attachComments(
  text: string,
  ast: AST.TASONExpression,
  tokens: Token[],
): CommentAttachment {
  const defaults = tokens.filter(
    (t) => t.channel === Token.DEFAULT_CHANNEL && t.type !== Token.EOF,
  );

  // token 起止 → token 序下标（token 不重叠，映射唯一）
  const byStart = new Map<number, number>();
  tokens.forEach((t, i) => byStart.set(t.start, i));
  const byEnd = new Map<number, number>();
  tokens.forEach((t, i) => byEnd.set(t.stop, i));

  const anchors: Anchor[] = [];
  const containers: ContainerNode[] = [];

  const collectContainers = (node: AST.TASONExpression): void => {
    switch (node.type) {
      case "ObjectExpression":
        containers.push(node);
        node.properties.forEach((p) => collectContainers(p.value));
        break;
      case "ArrayExpression":
        containers.push(node);
        node.elements.forEach(collectContainers);
        break;
      case "TypeInstance":
        containers.push(node);
        if (node.argument.type === "ObjectExpression") collectContainers(node.argument);
        break;
    }
  };

  const walk = (node: AST.TASONExpression, parentAnchor: Anchor | null): void => {
    switch (node.type) {
      case "ObjectExpression":
        for (const property of node.properties) {
          const anchor: Anchor = { node: property, parent: parentAnchor, firstTokenIndex: -1, lastTokenIndex: -1, scalarArgumentOf: null };
          const firstTokenIndex = byStart.get(property.start);
          const lastTokenIndex = byEnd.get(property.end - 1);
          if (firstTokenIndex !== undefined && lastTokenIndex !== undefined) {
            anchor.firstTokenIndex = firstTokenIndex;
            anchor.lastTokenIndex = lastTokenIndex;
            anchors.push(anchor);
          }
          walk(property.value, anchor.firstTokenIndex >= 0 ? anchor : parentAnchor);
        }
        break;
      case "ArrayExpression":
        for (const element of node.elements) {
          const anchor: Anchor = { node: element, parent: parentAnchor, firstTokenIndex: -1, lastTokenIndex: -1, scalarArgumentOf: null };
          const firstTokenIndex = byStart.get(element.start);
          const lastTokenIndex = byEnd.get(element.end - 1);
          if (firstTokenIndex !== undefined && lastTokenIndex !== undefined) {
            anchor.firstTokenIndex = firstTokenIndex;
            anchor.lastTokenIndex = lastTokenIndex;
            anchors.push(anchor);
          }
          walk(element, anchor.firstTokenIndex >= 0 ? anchor : parentAnchor);
        }
        break;
      case "TypeInstance": {
        const anchor: Anchor = { node: node.argument, parent: parentAnchor, firstTokenIndex: -1, lastTokenIndex: -1, scalarArgumentOf: node };
        const firstTokenIndex = byStart.get(node.argument.start);
        const lastTokenIndex = byEnd.get(node.argument.end - 1);
        if (firstTokenIndex !== undefined && lastTokenIndex !== undefined) {
          anchor.firstTokenIndex = firstTokenIndex;
          anchor.lastTokenIndex = lastTokenIndex;
          anchors.push(anchor);
        }
        if (node.argument.type === "ObjectExpression") {
          walk(node.argument, anchor.firstTokenIndex >= 0 ? anchor : parentAnchor);
        }
        break;
      }
    }
  };

  const rootAnchor: Anchor = { node: ast, parent: null, firstTokenIndex: byStart.get(ast.start) ?? -1, lastTokenIndex: byEnd.get(ast.end - 1) ?? -1, scalarArgumentOf: null };
  if (rootAnchor.firstTokenIndex >= 0 && rootAnchor.lastTokenIndex >= 0) {
    anchors.push(rootAnchor);
  }
  walk(ast, rootAnchor.firstTokenIndex >= 0 ? rootAnchor : null);
  collectContainers(ast);

  const innermostCovering = (token: Token): Anchor | null => {
    let best: Anchor | null = null;
    for (const anchor of anchors) {
      const node = anchor.node;
      if (node.start <= token.start && token.stop < node.end) {
        if (!best || node.start > best.node.start) best = anchor;
      }
    }
    return best;
  };

  const anchorStartingAt = (offset: number): Anchor | null => {
    for (const anchor of anchors) {
      if (anchor.node.start === offset) return anchor;
    }
    return null;
  };

  const anchorEndingBefore = (tokenIndex: number): Anchor | null => {
    let best: Anchor | null = null;
    for (const anchor of anchors) {
      if (anchor.lastTokenIndex < tokenIndex) {
        if (!best || anchor.lastTokenIndex > best.lastTokenIndex) best = anchor;
      }
    }
    return best;
  };

  const firstAnchorAfter = (offset: number): Anchor | null => {
    let best: Anchor | null = null;
    for (const anchor of anchors) {
      if (anchor.node.start > offset) {
        if (!best || anchor.node.start < best.node.start) best = anchor;
      }
    }
    return best;
  };

  const attachment: CommentAttachment = {
    leading: new Map(),
    trailing: new Map(),
    dangling: new Map(),
    fileTail: [],
  };

  const push = <K>(map: Map<K, AttachedComment[]>, key: K, item: AttachedComment): void => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };

  for (const token of tokens) {
    if (token.channel !== Token.HIDDEN_CHANNEL) continue;

    // 相邻 token（任意通道），用于空行保留判定
    const prevToken = tokens[token.tokenIndex - 1];
    const nextToken = tokens[token.tokenIndex + 1];
    const item: AttachedComment = {
      comment: token.type === TASONLexer.SINGLE_LINE_COMMENT
        ? { type: "CommentLine", start: token.start, end: token.stop + 1, value: token.text.slice(2) }
        : { type: "CommentBlock", start: token.start, end: token.stop + 1, value: token.text.slice(2, -2) },
      blankBefore: prevToken != null && countNewlines(text, prevToken.stop + 1, token.start) >= 2,
      blankAfter: nextToken != null && countNewlines(text, token.stop + 1, nextToken.start) >= 2,
    };

    // 前一个 / 后一个 default 通道 token（不含 EOF）
    let prevDefault: Token | null = null;
    for (let i = token.tokenIndex - 1; i >= 0; i--) {
      const t = tokens[i];
      if (t.channel === Token.DEFAULT_CHANNEL && t.type !== Token.EOF) { prevDefault = t; break; }
    }
    let nextDefault: Token | null = null;
    for (let i = token.tokenIndex + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.channel === Token.DEFAULT_CHANNEL && t.type !== Token.EOF) { nextDefault = t; break; }
    }

    const sameLineAsPrev =
      prevDefault != null && countNewlines(text, prevDefault.stop + 1, token.start) === 0;

    // 1) 行末注释：与前一个 default token 同行，且该 token 在锚的内容末尾（不是开头/中段）
    if (sameLineAsPrev && prevDefault != null) {
      const owner = prevDefault.text === ","
        ? anchorEndingBefore(prevDefault.tokenIndex)
        : innermostCovering(prevDefault);
      if (owner && prevDefault.tokenIndex >= owner.lastTokenIndex) {
        let target = owner;
        if (
          owner.scalarArgumentOf != null &&
          token.type === TASONLexer.SINGLE_LINE_COMMENT &&
          owner.parent != null
        ) {
          // 行注释不能留在 scalar 参数后（会吞掉 ')'），提升到父锚行末
          target = owner.parent;
        }
        push(attachment.trailing, target.node, item);
        continue;
      }
    }

    // 2) dangling：下一 default token 是闭括号，且注释位于对应容器内
    if (nextDefault != null && (nextDefault.text === "}" || nextDefault.text === "]" || nextDefault.text === ")")) {
      const container = containers.find(
        (c) => c.end - 1 === nextDefault!.start && token.start > c.start,
      );
      if (container) {
        push(attachment.dangling, container, item);
        continue;
      }
    }

    // 3) 文件尾：根值之后、EOF 之前
    if (nextDefault == null) {
      attachment.fileTail.push(item);
      continue;
    }

    // 4) 同行但位于锚的开头/中段：提升为该锚的前导注释
    if (sameLineAsPrev && prevDefault != null) {
      const owner = innermostCovering(prevDefault);
      if (owner) {
        push(attachment.leading, owner.node, item);
        continue;
      }
    }

    // 5) 前导注释：归属下一个元素
    let anchor = anchorStartingAt(nextDefault.start);
    if (anchor == null && nextDefault.text === ",") {
      anchor = firstAnchorAfter(nextDefault.start);
    }
    if (anchor == null) anchor = innermostCovering(nextDefault);
    if (anchor == null) anchor = firstAnchorAfter(nextDefault.start);
    if (anchor != null) {
      push(attachment.leading, anchor.node, item);
    } else {
      // 理论不可达（任何注释后面总有 default token 或已进文件尾分支）
      attachment.fileTail.push(item);
    }
  }

  return attachment;
}
