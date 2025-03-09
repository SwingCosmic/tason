import { defineType } from "../TASONTypeInfo";

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


export const SymbolTypeInfo = defineType<symbol>({
  kind: "scalar",
  ctor: Symbol as any,
  serialize: (value) => {
    const match = value.toString().match(/^Symbol\((.+)\)$/);
    if (!match) {
      throw new TypeError(`Cannot serialize local symbols`);
    }
    return match[1];
  },
  deserialize: (value) => {
    if (value in wellknownSymbols) {
      return wellknownSymbols[value as WellknownSymbolNames];
    }
    return Symbol.for(value);
  },
});