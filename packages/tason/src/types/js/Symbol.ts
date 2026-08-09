import { defineType } from "@/TASONTypeInfo";

type WellknownSymbolNames = `Symbol.${Exclude<
  keyof SymbolConstructor,
  "prototype" | "for" | "keyFor"
>}`;

const wellknownSymbols: Record<WellknownSymbolNames, symbol> = {
  "Symbol.asyncDispose": Symbol.asyncDispose,
  "Symbol.asyncIterator": Symbol.asyncIterator,
  "Symbol.dispose": Symbol.dispose,
  "Symbol.hasInstance": Symbol.hasInstance,
  "Symbol.isConcatSpreadable": Symbol.isConcatSpreadable,
  "Symbol.iterator": Symbol.iterator,
  "Symbol.match": Symbol.match,
  "Symbol.matchAll": Symbol.matchAll,
  "Symbol.metadata": Symbol.metadata,
  "Symbol.observable": Symbol.observable,
  "Symbol.replace": Symbol.replace,
  "Symbol.search": Symbol.search,
  "Symbol.split": Symbol.split,
  "Symbol.species": Symbol.species,
  "Symbol.toPrimitive": Symbol.toPrimitive,
  "Symbol.toStringTag": Symbol.toStringTag,
  "Symbol.unscopables": Symbol.unscopables,
};

/** description → well-known（反序列化） */
const wellknownByDescription = wellknownSymbols;

/** 身份 → description（序列化 well-known；避免本地 Symbol("Symbol.iterator") 被当成可序列化） */
const wellknownDescriptionBySymbol = new Map<symbol, WellknownSymbolNames>(
  Object.entries(wellknownSymbols).map(([name, sym]) => [
    sym as symbol,
    name as WellknownSymbolNames,
  ]),
);

/**
 * Symbol 标量（需 allowUnsafeTypes 才注册）。
 *
 * - 仅 **全局注册表** `Symbol.for(key)` 与 **well-known** 可往返
 * - **本地** `Symbol()` / `Symbol("desc")` 不可序列化（无法在对端还原同一身份）
 * - 描述为 `Symbol.iterator` 的 `Symbol.for("Symbol.iterator")` 反序列化会落到 well-known
 *   `Symbol.iterator`（与 for 注册表项不是同一引用）—— well-known 名优先
 */
export const SymbolTypeInfo = defineType<symbol>({
  kind: "scalar",
  ctor: Symbol as any,
  serialize: (value) => {
    // 1. 全局 Symbol.for
    const keyFor = Symbol.keyFor(value);
    if (keyFor !== undefined) {
      return keyFor;
    }
    // 2. well-known（无 keyFor）
    const wellknown = wellknownDescriptionBySymbol.get(value);
    if (wellknown !== undefined) {
      return wellknown;
    }
    // 3. 本地 Symbol：禁止（旧实现用 toString 会把 Symbol("x") 误当成可序列化）
    throw new TypeError(
      `Cannot serialize local symbols (only Symbol.for(...) and well-known symbols are supported)`,
    );
  },
  deserialize: (value) => {
    if (value in wellknownByDescription) {
      return wellknownByDescription[value as WellknownSymbolNames];
    }
    return Symbol.for(value);
  },
});
