import { createRequire } from "node:module";

declare const __filename: string | undefined;
declare const process: { cwd(): string };

/**
 * TASON TypeInfo 实际绑定的 bson 类集合。
 * `mongoose.mongo` / `mongodb` 命名空间 / `require('bson')` 均可。
 */
export interface BsonNamespace {
  Long: typeof import("bson").Long;
  ObjectId: typeof import("bson").ObjectId;
  Decimal128: typeof import("bson").Decimal128;
  Int32: typeof import("bson").Int32;
  Double: typeof import("bson").Double;
  UUID: typeof import("bson").UUID;
  Binary: typeof import("bson").Binary;
  Timestamp: typeof import("bson").Timestamp;
  MinKey: typeof import("bson").MinKey;
  MaxKey: typeof import("bson").MaxKey;
  Code: typeof import("bson").Code;
}

const BSON_KEYS = [
  "Long",
  "ObjectId",
  "Decimal128",
  "Int32",
  "Double",
  "UUID",
  "Binary",
  "Timestamp",
  "MinKey",
  "MaxKey",
  "Code",
] as const;

/** 未 `registerMongoDBTypes({ bson })` 之前为空，避免模块加载时误拉 ESM/CJS 副本。 */
let bound: BsonNamespace | undefined;

function requireAnchor(): string {
  if (typeof __filename === "string") {
    return __filename;
  }
  return process.cwd() + "/package.json";
}

/**
 * 当前绑定的 bson。未注册时抛错，不隐式 `import` / `require`。
 */
export function getBson(): BsonNamespace {
  if (!bound) {
    throw new Error(
      "tason-mongodb: bson is not bound; call registerMongoDBTypes(registry, { bson })",
    );
  }
  return bound;
}

export function isBsonBound(): boolean {
  return bound != null;
}

/**
 * 仅供 {@link registerMongoDBTypes} 写入。重复调用替换引用；
 * 静态 TypeInfo 的 `ctor` / deserialize 经 getter 读到新 class。
 */
export function bindBson(ns: BsonNamespace): BsonNamespace {
  if (ns == null) {
    throw new Error(
      "tason-mongodb: options.bson is required; pass mongoose.mongo or loadDefaultBson()",
    );
  }
  for (const key of BSON_KEYS) {
    if (typeof ns[key] !== "function") {
      throw new Error(`tason-mongodb: bson.${key} is required`);
    }
  }
  bound = ns;
  return bound;
}

/**
 * 显式取出 Node CJS `bson`（与 `mongodb` / `mongoose.mongo` 同一副本）。
 * 不会写入持有点；要绑定须交给 `registerMongoDBTypes(..., { bson })`。
 */
export function loadDefaultBson(): BsonNamespace {
  return createRequire(requireAnchor())("bson") as BsonNamespace;
}
