// STRING 字面量解码与重转义（design.md §3.2）。
// 词法允许的转义与 grammar ESC 规则一一对应：\" \' \\ \b \f \n \r \t \v \0 \xHH \uHHHH。
// 重转义只做「必要转义」：目标引号、反斜杠、控制字符（短名优先，其余 \uXXXX），
// 不保留原转义形态。

/** 解码 STRING token 原文（含定界引号）为字符串值 */
export function decodeStringLiteral(raw: string): string {
  const inner = raw.length >= 2 ? raw.slice(1, -1) : raw;
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const esc = inner[++i];
    switch (esc) {
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "r": out += "\r"; break;
      case "b": out += "\b"; break;
      case "f": out += "\f"; break;
      case "v": out += "\v"; break;
      case "0": out += "\0"; break;
      case "x":
        out += String.fromCharCode(parseInt(inner.slice(i + 1, i + 3), 16));
        i += 2;
        break;
      case "u":
        out += String.fromCharCode(parseInt(inner.slice(i + 1, i + 5), 16));
        i += 4;
        break;
      default:
        // 剩余合法形态只有 " 与 '（\ 已被 switch 前的消费覆盖不到，此处兜底原样）
        out += esc;
        break;
    }
  }
  return out;
}

/** 按目标引号重新转义字符串值，返回含定界引号的字面量 */
export function quoteString(value: string, quote: '"' | "'"): string {
  let out = quote;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = value.charCodeAt(i);
    if (ch === "\\") {
      out += "\\\\";
      continue;
    }
    if (ch === quote) {
      out += "\\" + quote;
      continue;
    }
    switch (code) {
      case 0x0a: out += "\\n"; continue;
      case 0x09: out += "\\t"; continue;
      case 0x0d: out += "\\r"; continue;
      case 0x08: out += "\\b"; continue;
      case 0x0c: out += "\\f"; continue;
      case 0x0b: out += "\\v"; continue;
      case 0x00: out += "\\0"; continue;
    }
    if (code < 0x20) {
      // 控制字符用 \xXX 短形态（grammar HEX_ESC）
      out += "\\x" + code.toString(16).padStart(2, "0");
      continue;
    }
    if (code >= 0xd800 && code <= 0xdfff) {
      // 合法代理对（> U+FFFF，如 emoji）原样输出；未配对代理项转义为
      // \uXXXX——直接输出裸的未配对代理项，落盘 UTF-8 时会损坏成替换符
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : -1;
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        out += ch + value[i + 1];
        i++;
      } else {
        out += "\\u" + code.toString(16).padStart(4, "0");
      }
      continue;
    }
    out += ch;
  }
  return out + quote;
}
