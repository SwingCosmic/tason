import Decimal from "decimal.js";
import {
  Decimal128,
  Float32,
  Float64,
  INumber,
  Int16,
  Int32,
  Int64,
  UInt8,
} from "./numbers";
import type {
  DeserializeNumberHandling,
  SerializeNumberHandling,
} from "../TASONSerializerOptions";

/** TASON 类型名及别名中的数值标量类型名 */
export const NUMBER_TYPE_NAMES = new Set([
  "UInt8",
  "Int16",
  "Int32",
  "Int64",
  "Float32",
  "Float64",
  "Decimal128",
  "BigInt",
  // aliases
  "Byte",
  "Short",
  "Int",
  "Long",
  "Single",
  "Double",
]);

const NUMBER_WRAPPER_CTORS = [
  UInt8,
  Int16,
  Int32,
  Int64,
  Float32,
  Float64,
  Decimal128,
] as const;

/**
 * Handling 解析上下文。
 * 序列化：C# `ValueScope` — OT 成员路径上 `object-type-property` ≈ all。
 * 反序列化：`object-fallback-all` 在 OT 成员路径上无契约时 ≈ all。
 */
export interface NumberHandlingContext {
  /** 当前值处于 ObjectTypeInstance 成员（含其内数组/嵌套 plain object） */
  inObjectType?: boolean;
}

/** 无契约时的有效序列化策略 */
export type EffectiveSerializeNumberHandling =
  | "unsafe-only"
  | "all"
  | "none";

/** 无契约时的有效反序列化策略 */
export type EffectiveDeserializeNumberHandling = "native" | "all";

export function resolveSerializeNumberHandling(
  handling: SerializeNumberHandling,
  ctx?: NumberHandlingContext,
): EffectiveSerializeNumberHandling {
  if (handling === "object-type-property") {
    // 与 .NET 一致：ObjectType 属性内 ≈ All；外 ≈ UnsafeOnly
    return ctx?.inObjectType ? "all" : "unsafe-only";
  }
  return handling;
}

export function resolveDeserializeNumberHandling(
  handling: DeserializeNumberHandling,
  ctx?: NumberHandlingContext,
): EffectiveDeserializeNumberHandling {
  if (handling === "all") {
    return "all";
  }
  if (handling === "object-fallback-all") {
    // 无契约时：OT 内保留包装；外层全拆箱
    return ctx?.inObjectType ? "all" : "native";
  }
  // object-fallback-native / native：值级路径按 native 拆箱；
  // 有 schema 契约时由 mapTypeInstanceToRuntime / Visitor 另行处理
  return "native";
}

export function isNumberTypeName(name: string): boolean {
  return NUMBER_TYPE_NAMES.has(name);
}

export function isNumberWrapper(value: unknown): value is INumber<unknown> {
  if (value == null || typeof value !== "object") {
    return false;
  }
  return NUMBER_WRAPPER_CTORS.some((C) => value instanceof C);
}

/**
 * 按反序列化选项对数值 TypeInstance 拆箱。
 * 非数值类型原样返回。
 */
export function unwrapNumberInstance(
  value: unknown,
  handling: DeserializeNumberHandling,
  ctx?: NumberHandlingContext,
): unknown {
  if (resolveDeserializeNumberHandling(handling, ctx) === "all") {
    return value;
  }

  if (isNumberWrapper(value)) {
    return value.value;
  }

  // BigInt 标量 deserialize 已是原生 bigint；其它 TypeInstance 不动
  return value;
}

export function isSafeIntegerBigInt(value: bigint): boolean {
  return (
    value >= BigInt(Number.MIN_SAFE_INTEGER) &&
    value <= BigInt(Number.MAX_SAFE_INTEGER)
  );
}

/** Decimal 能否无损表示为 JS number（用于 unsafe-only 是否裸写） */
export function isDecimalSafeAsNumber(value: Decimal): boolean {
  if (!value.isFinite()) {
    return false;
  }
  const n = value.toNumber();
  if (!Number.isFinite(n)) {
    return false;
  }
  return new Decimal(n).equals(value);
}

/**
 * serialize `unsafe-only`：尽量写成 **number 字面量**（含 safe bigint）。
 * - 包装类拆到 `.value` 再判断
 * - Decimal 仅在可无损转为 number 时裸写
 * - 无法安全表示时返回 null → 调用方写 TypeName
 */
export function trySerializeNumberAsSafeNumberLiteral(
  value: unknown,
): string | null {
  if (isNumberWrapper(value)) {
    return trySerializeNumberAsSafeNumberLiteral(value.value);
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value.toString(10);
    }
    return null;
  }

  if (typeof value === "bigint") {
    if (isSafeIntegerBigInt(value)) {
      return value.toString(10);
    }
    return null;
  }

  if (value instanceof Decimal) {
    if (isDecimalSafeAsNumber(value)) {
      return value.toNumber().toString(10);
    }
    return null;
  }

  return null;
}

/**
 * serialize `none`：**强制**裸字面量（含超大 bigint、超精度 Decimal；精度/范围风险由用户承担）。
 * 对已知数值形态应总能返回字符串；未知类型返回 null。
 */
export function trySerializeNumberAsLiteral(value: unknown): string | null {
  if (isNumberWrapper(value)) {
    return trySerializeNumberAsLiteral(value.value);
  }

  if (typeof value === "number") {
    // 含 NaN / ±Infinity
    return value.toString(10);
  }

  if (typeof value === "bigint") {
    // 含超出 MAX_SAFE_INTEGER 的整数，直接写十进制字面量
    return value.toString(10);
  }

  if (value instanceof Decimal) {
    return value.toString();
  }

  return null;
}
