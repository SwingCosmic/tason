import Decimal from "decimal.js";
import type { RuntimeType } from "./RuntimeType";
import {
  isNumberWrapper,
  isSafeIntegerBigInt,
  unwrapNumberInstance,
} from "@/types/NumberHandling";
import type { DeserializeNumberHandling } from "@/TASONSerializerOptions";

/** 收敛 instance 字段时：期望的 JS 构造函数（仅用于 instanceof 校验/透传） */
export interface MapToRuntimeContext {
  /** runtimeType === "instance" 时的期望 JS 构造函数 */
  ctor?: abstract new (...args: any[]) => any;
}

/**
 * 将反序列化得到的值收敛到期望 RuntimeType（叶子）。
 *
 * **字面量保真（JSON 风格）：**  
 * 数字/字符串/布尔/null/对象/数组字面量本身已携带「无需再描述的准确类型」。  
 * - 数字字面量 → 某种数字 RuntimeType（number/bigint/decimal 之间可按契约收）  
 * - **字符串字面量只表示字符串**——不得把 `"1"` 当数字、把 RFC3339 当 Date、把 `"/a/"` 当 RegExp  
 * - 非 JSON 可表达的类型必须经 **TypeInstance**（TypeName）进入，再映射到 RuntimeType  
 *
 * 同一数字 RuntimeType 可来自多种 **数值** TypeInstance（如 bigint ← Int64 / BigInt / 数字字面量）。
 */
export function mapTypeInstanceToRuntime(
  runtimeType: RuntimeType,
  value: unknown,
  handling: DeserializeNumberHandling,
  ctx?: MapToRuntimeContext,
): unknown {
  // native：忽略契约，全拆箱（仅数值包装；instance 原样）
  if (handling === "native") {
    if (runtimeType === "instance") {
      return passInstance(value, ctx);
    }
    return unwrapNumberInstance(value, "native");
  }
  // all：保留包装
  if (handling === "all") {
    if (runtimeType === "instance") {
      return passInstance(value, ctx);
    }
    return value;
  }

  // object-fallback-*：有叶子契约时一律按 kind 收到 RuntimeType
  // （object-fallback-all 的「OT 内 ≈ all」只作用于无契约路径，不能压过 ClassMetadata）
  switch (runtimeType) {
    case "bigint":
      return toBigInt(value);
    case "number":
      return toNumber(value);
    case "decimal":
      return toDecimal(value);
    case "instance":
      return passInstance(value, ctx);
    case "string":
    case "boolean":
    case "object":
    case "array":
    case "unknown":
    default:
      return value;
  }
}

/**
 * instance 字段：
 * - 已是期望 ctor 的实例（通常来自 TypeInstance `Date("…")` / `RegExp("…")`）→ 透传
 * - **拒绝**用字符串/数字字面量冒充（那是 JSON 无类型时的妥协，TASON 不用）
 */
function passInstance(value: unknown, ctx?: MapToRuntimeContext): unknown {
  const ctor = ctx?.ctor;
  if (
    ctor &&
    typeof value === "object" &&
    value !== null &&
    value instanceof ctor
  ) {
    return value;
  }
  // 无 ctor 信息时原样返回（无法识别则不硬转换）
  if (!ctor) {
    return value;
  }
  // 已是实例但 ctor 未匹配：仍返回原值，不把 string/number 偷换成实例
  return value;
}

/**
 * 仅从「数字类」值收敛到 bigint：number / bigint / 数值包装 / 整数 Decimal。  
 * **不**接受字符串字面量。
 */
function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (isNumberWrapper(value)) {
    const inner = value.value;
    if (typeof inner === "bigint") {
      return inner;
    }
    if (typeof inner === "number" && Number.isInteger(inner)) {
      return BigInt(inner);
    }
    if (inner instanceof Decimal && inner.isInteger()) {
      return BigInt(inner.toFixed(0));
    }
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }
  if (value instanceof Decimal && value.isInteger()) {
    return BigInt(value.toFixed(0));
  }
  throw new Error(
    `Cannot map value to bigint (string literals are not numbers): ${String(value)}`,
  );
}

/**
 * 仅从「数字类」值收敛到 number。**不**接受字符串字面量。
 * bigint / Int64：仅安全整数可收；超范围抛错（不静默截断）。
 */
function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (isNumberWrapper(value)) {
    const inner = value.value;
    if (typeof inner === "number") {
      return inner;
    }
    if (typeof inner === "bigint") {
      return bigintToSafeNumber(inner);
    }
    if (inner instanceof Decimal) {
      return inner.toNumber();
    }
  }
  if (typeof value === "bigint") {
    return bigintToSafeNumber(value);
  }
  if (value instanceof Decimal) {
    return value.toNumber();
  }
  throw new Error(
    `Cannot map value to number (string literals are not numbers): ${String(value)}`,
  );
}

function bigintToSafeNumber(bi: bigint): number {
  if (!isSafeIntegerBigInt(bi)) {
    throw new Error(
      `Cannot map bigint ${bi.toString(10)} to number: outside Number safe integer range`,
    );
  }
  return Number(bi);
}

/**
 * 仅从「数字类」值收敛到 Decimal。**不**接受字符串字面量（Decimal128 TypeInstance 已是包装/Decimal）。
 */
function toDecimal(value: unknown): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  if (isNumberWrapper(value)) {
    const inner = value.value;
    if (inner instanceof Decimal) {
      return inner;
    }
    if (typeof inner === "number" || typeof inner === "bigint") {
      return new Decimal(inner.toString());
    }
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return new Decimal(value.toString());
  }
  throw new Error(
    `Cannot map value to decimal (string literals are not numbers): ${String(value)}`,
  );
}
