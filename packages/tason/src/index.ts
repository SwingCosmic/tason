import "reflect-metadata";

import TASONSerializer from "./TASONSerializer";
import TASONTypeRegistry from "./TASONTypeRegistry";
import { formatTASON, parseSyntax } from "./syntax";
import { Types } from "./types";

export { default as TASONSerializer } from "./TASONSerializer";
export { default as TASONTypeRegistry } from "./TASONTypeRegistry";
export type { RegisterTypeOptions } from "./TASONTypeRegistry";

export type {
  TASONSerializerOptions,
  TASONSerializerOptionsInit,
  SerializeNumberHandling,
  DeserializeNumberHandling,
  NullValueHandling,
} from "./TASONSerializerOptions";

export type { TASONTypeInfo, TASONNamedTypeInfo } from "./TASONTypeInfo";
export { defineType } from "./TASONTypeInfo";

export type { TasonClassMetadata } from "./metadata";
export {
  TASONType,
  setTypeName,
  getDeclaredType,
  TypeDiscriminatorKey,
} from "./metadata";

export type { RuntimeType, RuntimeSchemaAdapter, RuntimeSerializeForm } from "./schema";
export {
  createValibotAdapter,
  mapTypeInstanceToRuntime,
  mapRuntimeToTypeInstance,
} from "./schema";

export { formatTASON, parseSyntax };
export type {
  ArrayExpression,
  BooleanLiteral,
  CommentBlock,
  CommentLine,
  FormatResult,
  Identifier,
  NullLiteral,
  NumericLiteral,
  ObjectExpression,
  ObjectProperty,
  StringLiteral,
  SyntaxDiagnostic,
  SyntaxParseResult,
  TASONComment,
  TASONExpression,
  TASONFormatOptions,
  TypeInstance,
} from "./syntax";

export interface TASONStatic extends TASONSerializer {
  Serializer: typeof TASONSerializer;
  Types: typeof Types;
  Registry: typeof TASONTypeRegistry;
  /** 语法层解析：不查类型注册表 */
  parseSyntax: typeof parseSyntax;
  /** 按选项整体重排文本。函数本体名为 formatTASON */
  format: typeof formatTASON;
}

const TASON: TASONStatic = new TASONSerializer() as any;
TASON.Serializer = TASONSerializer;
TASON.Types = Types;
TASON.Registry = TASONTypeRegistry;
TASON.parseSyntax = parseSyntax;
TASON.format = formatTASON;

export default TASON;