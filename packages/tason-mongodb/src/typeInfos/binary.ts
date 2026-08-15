import { defineType } from "tason";
import { Binary, UUID } from "bson";

/** UUID / MD5 / Encrypted / Sensitive / Vector 不走 Buffer 追加实现 */
const DEDICATED_BINARY_SUBTYPES = new Set<number>([
  Binary.SUBTYPE_UUID_OLD,
  Binary.SUBTYPE_UUID,
  Binary.SUBTYPE_MD5,
  Binary.SUBTYPE_ENCRYPTED,
  Binary.SUBTYPE_SENSITIVE,
  Binary.SUBTYPE_VECTOR,
]);

const MD5_HEX = /^[0-9a-fA-F]{32}$/;
const HEX_BODY = /^[0-9a-fA-F]*$/;
const BASE64_BODY = /^[A-Za-z0-9/+=]*$/;

type VectorDtype = "int8" | "float32" | "packedBit";

interface BSONVectorArg {
  dtype?: unknown;
  values?: unknown;
  padding?: unknown;
}

function binaryBytes(value: Binary): Uint8Array {
  return value.value();
}

function encodeBufferText(value: Binary): string {
  return "base64," + value.toString("base64");
}

function decodeBufferText(value: string): { type: "base64" | "hex"; data: string } {
  const index = value.indexOf(",");
  if (index < 0) {
    throw new TypeError(`Invalid data string: '${value.slice(0, 20)} ...'`);
  }
  const type = value.slice(0, index).toLowerCase();
  const data = value.slice(index + 1).trim();
  if (type === "base64") {
    if (!BASE64_BODY.test(data)) {
      throw new TypeError("Invalid base64 string.");
    }
    return { type, data };
  }
  if (type === "hex") {
    if (!HEX_BODY.test(data) || data.length % 2 === 1) {
      throw new TypeError("Invalid hex string.");
    }
    return { type, data };
  }
  throw new TypeError(`Invalid buffer type: ${type}`);
}

function binaryFromBufferText(value: string, subType: number): Binary {
  const { type, data } = decodeBufferText(value);
  return type === "hex"
    ? Binary.createFromHexString(data, subType)
    : Binary.createFromBase64(data, subType);
}

function requireNumberArray(values: unknown, label: string): number[] {
  if (!Array.isArray(values) || values.some((item) => typeof item !== "number")) {
    throw new TypeError(`BSONVector ${label} must be an array of numbers`);
  }
  return values;
}

export const BufferTypeInfo = defineType<Binary>({
  kind: "scalar",
  ctor: Binary,
  match: (value) =>
    !(value instanceof UUID) && !DEDICATED_BINARY_SUBTYPES.has(value.sub_type),
  serialize: encodeBufferText,
  deserialize: (value) =>
    binaryFromBufferText(value, Binary.SUBTYPE_DEFAULT),
});

export const MD5TypeInfo = defineType<Binary>({
  kind: "scalar",
  ctor: Binary,
  match: (value) => value.sub_type === Binary.SUBTYPE_MD5,
  serialize: (value) => {
    const bytes = binaryBytes(value);
    if (bytes.length !== 16) {
      throw new TypeError("MD5 requires 16 bytes");
    }
    return value.toString("hex");
  },
  deserialize: (value) => {
    const hex = value.trim();
    if (!MD5_HEX.test(hex)) {
      throw new TypeError(`Invalid MD5: ${value}`);
    }
    return Binary.createFromHexString(hex, Binary.SUBTYPE_MD5);
  },
});

export const BSONEncryptedTypeInfo = defineType<Binary>({
  kind: "scalar",
  ctor: Binary,
  match: (value) => value.sub_type === Binary.SUBTYPE_ENCRYPTED,
  serialize: encodeBufferText,
  deserialize: (value) =>
    binaryFromBufferText(value, Binary.SUBTYPE_ENCRYPTED),
});

export const BSONSensitiveTypeInfo = defineType<Binary>({
  kind: "scalar",
  ctor: Binary,
  match: (value) => value.sub_type === Binary.SUBTYPE_SENSITIVE,
  serialize: encodeBufferText,
  deserialize: (value) =>
    binaryFromBufferText(value, Binary.SUBTYPE_SENSITIVE),
});

export const BSONVectorTypeInfo = defineType<Binary>({
  kind: "object",
  ctor: Binary,
  match: (value) => value.sub_type === Binary.SUBTYPE_VECTOR,
  serialize: (value) => {
    const dtypeCode = value.buffer[0];
    if (dtypeCode === Binary.VECTOR_TYPE.Int8) {
      return { dtype: "int8", values: Array.from(value.toInt8Array()) };
    }
    if (dtypeCode === Binary.VECTOR_TYPE.Float32) {
      return { dtype: "float32", values: Array.from(value.toFloat32Array()) };
    }
    if (dtypeCode === Binary.VECTOR_TYPE.PackedBit) {
      const padding = value.buffer[1] ?? 0;
      const payload: { dtype: VectorDtype; values: number[]; padding?: number } = {
        dtype: "packedBit",
        values: Array.from(value.toPackedBits()),
      };
      if (padding !== 0) {
        payload.padding = padding;
      }
      return payload;
    }
    throw new TypeError(`Unsupported BSONVector dtype: ${dtypeCode}`);
  },
  deserialize: (value) => {
    const arg = value as BSONVectorArg;
    const values = requireNumberArray(arg.values, "values");
    if (arg.dtype === "int8") {
      return Binary.fromInt8Array(Int8Array.from(values));
    }
    if (arg.dtype === "float32") {
      return Binary.fromFloat32Array(Float32Array.from(values));
    }
    if (arg.dtype === "packedBit") {
      const padding = arg.padding ?? 0;
      if (typeof padding !== "number" || padding < 0 || padding > 7) {
        throw new TypeError("BSONVector packedBit padding must be 0-7");
      }
      return Binary.fromPackedBits(Uint8Array.from(values), padding);
    }
    throw new TypeError(`Unsupported BSONVector dtype: ${String(arg.dtype)}`);
  },
});
