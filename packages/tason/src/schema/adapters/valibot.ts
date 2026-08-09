import type {
  ArraySchema,
  DateSchema,
  ExactOptionalSchema,
  GenericSchema,
  InstanceSchema,
  LooseObjectSchema,
  NonNullableSchema,
  NonNullishSchema,
  NonOptionalSchema,
  NullableSchema,
  NullishSchema,
  ObjectSchema,
  ObjectWithRestSchema,
  OptionalSchema,
  StrictObjectSchema,
  UndefinedableSchema,
} from "valibot";
import type { RuntimeSchemaAdapter } from "../RuntimeSchemaAdapter";
import type { RuntimeType } from "../RuntimeType";

/** Valibot schema（官方 GenericSchema；import type 仅编译期，无运行时依赖） */
type ValibotSchema = GenericSchema;

/** 带 entries 的 object 族 */
type ObjectLikeSchema =
  | ObjectSchema<Record<string, ValibotSchema>, any>
  | LooseObjectSchema<Record<string, ValibotSchema>, any>
  | StrictObjectSchema<Record<string, ValibotSchema>, any>
  | ObjectWithRestSchema<Record<string, ValibotSchema>, ValibotSchema, any>;

/** optional / nullable 等包装层（统一有 wrapped） */
type WrapperSchema =
  | OptionalSchema<ValibotSchema, any>
  | NullableSchema<ValibotSchema, any>
  | NullishSchema<ValibotSchema, any>
  | ExactOptionalSchema<ValibotSchema, any>
  | UndefinedableSchema<ValibotSchema, any>
  | NonOptionalSchema<ValibotSchema, any>
  | NonNullableSchema<ValibotSchema, any>
  | NonNullishSchema<ValibotSchema, any>;

// Valibot Class = 非 abstract 构造函数；用 any 放宽以匹配 import type 结构
type InstanceLikeSchema =
  | InstanceSchema<any, any>
  | DateSchema<any>;

const OBJECT_TYPES = new Set([
  "object",
  "loose_object",
  "strict_object",
  "object_with_rest",
]);

const WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "nullish",
  "exact_optional",
  "undefinedable",
  "non_optional",
  "non_nullable",
  "non_nullish",
]);

function isObjectLike(schema: ValibotSchema): schema is ObjectLikeSchema {
  return OBJECT_TYPES.has(schema.type) && "entries" in schema;
}

function isArraySchema(
  schema: ValibotSchema,
): schema is ArraySchema<ValibotSchema, any> {
  return schema.type === "array" && "item" in schema;
}

function isWrapper(schema: ValibotSchema): schema is WrapperSchema {
  return WRAPPER_TYPES.has(schema.type) && "wrapped" in schema;
}

/** instance(Class) 或 date()（date 即 Date 实例的一等 schema） */
function isInstanceLike(schema: ValibotSchema): schema is InstanceLikeSchema {
  if (schema.type === "date") return true;
  return schema.type === "instance" && "class" in schema;
}

function readInstanceCtor(
  schema: ValibotSchema,
): (abstract new (...args: any[]) => any) | null {
  const s = unwrap(schema);
  if (s.type === "date") {
    return Date;
  }
  if (s.type === "instance" && "class" in s) {
    return (s as InstanceSchema<any, any>).class;
  }
  return null;
}

/** 解包 optional / nullable / … 到内层叶子或结构 */
function unwrap(schema: ValibotSchema): ValibotSchema {
  let current: ValibotSchema = schema;
  for (let i = 0; i < 8; i++) {
    if (!isWrapper(current)) break;
    current = (current as WrapperSchema).wrapped;
  }
  return current;
}

/**
 * 创建 Valibot RuntimeSchemaAdapter。
 * **不会**自动注册；调用方：`registry.setSchemaAdapter(createValibotAdapter())`。
 *
 * Schema 侧只报告 JS RuntimeType（含 `instance(RegExp)` → ctor）；
 * 不把 TypeName 写进 RuntimeType —— 交叉映射由 Registry 完成。
 */
export function createValibotAdapter(): RuntimeSchemaAdapter<ValibotSchema> {
  return {
    isSchema(value: unknown): value is ValibotSchema {
      if (typeof value !== "object" || value === null) return false;
      const s = value as Partial<ValibotSchema>;
      return s.kind === "schema" && typeof s.type === "string";
    },

    objectEntries(
      schema: ValibotSchema,
    ): Iterable<[string, ValibotSchema]> | null {
      const s = unwrap(schema);
      if (!isObjectLike(s)) return null;
      return Object.entries(s.entries) as [string, ValibotSchema][];
    },

    arrayElement(schema: ValibotSchema): ValibotSchema | null {
      const s = unwrap(schema);
      if (!isArraySchema(s)) return null;
      return s.item;
    },

    runtimeType(schema: ValibotSchema): RuntimeType {
      const s = unwrap(schema);
      switch (s.type) {
        case "bigint":
          return "bigint";
        case "number":
          return "number";
        case "string":
          return "string";
        case "boolean":
          return "boolean";
        case "date":
        case "instance":
          // 准确 JS 运行时：class 实例；ctor 见 instanceCtor
          return "instance";
        case "object":
        case "loose_object":
        case "strict_object":
        case "object_with_rest":
          return "object";
        case "array":
        case "tuple":
        case "loose_tuple":
        case "strict_tuple":
        case "tuple_with_rest":
          return "array";
        default:
          // decimal 等无内置一等 schema 时仍 unknown；可用 instance(Decimal) 表达
          return "unknown";
      }
    },

    instanceCtor(schema: ValibotSchema) {
      return readInstanceCtor(schema);
    },
  };
}
