import Decimal from "decimal.js";
import type { RuntimeType } from "./RuntimeType";
import type { SerializeNumberHandling } from "@/TASONSerializerOptions";
import {
  isNumberWrapper,
  isSafeIntegerBigInt,
  resolveSerializeNumberHandling,
  trySerializeNumberAsLiteral,
  trySerializeNumberAsSafeNumberLiteral,
  type NumberHandlingContext,
} from "@/types/NumberHandling";

/** 序列化叶子映射结果：字面量文本，或 TypeInstance 的类型名 + 标量参数 */
export type RuntimeSerializeForm =
  | { form: "literal"; text: string }
  | { form: "type-instance"; typeName: string; scalarArg: string }
  | { form: "passthrough"; value: unknown };

/**
 * 按期望 RuntimeType + serialize Handling 决定写出形式。
 * RuntimeType → 多种 TypeInstance/字面量 的默认路径选择。
 * @param ctx 可选；`inObjectType` 使 object-type-property 在 OT 内按 all 解析
 */
export function mapRuntimeToTypeInstance(
  runtimeType: RuntimeType,
  value: unknown,
  serializeHandling: SerializeNumberHandling,
  ctx?: NumberHandlingContext,
): RuntimeSerializeForm {
  const effective = resolveSerializeNumberHandling(serializeHandling, ctx);

  switch (runtimeType) {
    case "bigint":
      return mapBigInt(value, effective);
    case "number":
      return mapNumber(value, effective);
    case "decimal":
      return mapDecimal(value, effective);
    case "string":
      if (typeof value === "string") {
        return { form: "passthrough", value };
      }
      return { form: "passthrough", value: String(value) };
    case "boolean":
      return { form: "passthrough", value: Boolean(value) };
    case "instance":
      // 实例 → TypeName 由 Generator/Registry.tryGetTypeInfo 完成，此处不硬编码 TypeName
      return { form: "passthrough", value };
    case "object":
    case "array":
    case "unknown":
    default:
      return { form: "passthrough", value };
  }
}

function unwrapToBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (isNumberWrapper(value)) {
    const inner = value.value;
    if (typeof inner === "bigint") return inner;
    if (typeof inner === "number" && Number.isInteger(inner)) return BigInt(inner);
  }
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  throw new Error(`Expected bigint-compatible value, got ${typeof value}`);
}

function unwrapToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (isNumberWrapper(value)) {
    const inner = value.value;
    if (typeof inner === "number") return inner;
    if (typeof inner === "bigint") return Number(inner);
  }
  if (typeof value === "bigint") return Number(value);
  throw new Error(`Expected number-compatible value, got ${typeof value}`);
}

function unwrapToDecimal(value: unknown): Decimal {
  if (value instanceof Decimal) return value;
  if (isNumberWrapper(value) && value.value instanceof Decimal) {
    return value.value;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") {
    return new Decimal(value.toString());
  }
  throw new Error(`Expected decimal-compatible value, got ${typeof value}`);
}

function mapBigInt(
  value: unknown,
  effective: "unsafe-only" | "all" | "none",
): RuntimeSerializeForm {
  const bi = unwrapToBigInt(value);
  if (effective === "none") {
    return { form: "literal", text: trySerializeNumberAsLiteral(bi)! };
  }
  if (effective === "unsafe-only") {
    const lit = trySerializeNumberAsSafeNumberLiteral(bi);
    if (lit != null) {
      return { form: "literal", text: lit };
    }
  }
  // all，或 unsafe-only 超范围：默认写 BigInt（与无契约 bigint 路径一致；override 可换 Int64）
  return { form: "type-instance", typeName: "BigInt", scalarArg: bi.toString(10) };
}

function mapNumber(
  value: unknown,
  effective: "unsafe-only" | "all" | "none",
): RuntimeSerializeForm {
  const n = unwrapToNumber(value);
  // number 默认不写 Int32；始终裸字面量（含 all）
  void effective;
  return { form: "literal", text: n.toString(10) };
}

function mapDecimal(
  value: unknown,
  effective: "unsafe-only" | "all" | "none",
): RuntimeSerializeForm {
  const d = unwrapToDecimal(value);
  if (effective === "none") {
    return { form: "literal", text: trySerializeNumberAsLiteral(d)! };
  }
  if (effective === "unsafe-only") {
    const lit = trySerializeNumberAsSafeNumberLiteral(d);
    if (lit != null) {
      return { form: "literal", text: lit };
    }
  }
  return {
    form: "type-instance",
    typeName: "Decimal128",
    scalarArg: d.toString(),
  };
}

/** 是否为安全整数 bigint（供测试/外部使用） */
export { isSafeIntegerBigInt };
