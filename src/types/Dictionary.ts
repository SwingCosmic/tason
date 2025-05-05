import { defineType } from "./TASONTypeInfo";

export interface MapStore<K = any, V = any> {
  pairs: [K, V][];
}

export const DictionaryTypeInfo = defineType({
  kind: "object",
  ctor: Map,
  serialize: (value, options) => {
    let pairs = Array.from(value.entries()).filter(p => {
      for (const e of p) {
        if (typeof e === "function") {
          return false;
        }
        if (!options.allowUnsafeTypes && typeof e === "symbol") {
          return false;
        }
        return true;
      }
    });

    return {
      pairs,
    } as MapStore;
  },
  deserialize: (value: MapStore) => {
    const entries = value.pairs;
    return new Map(entries);
  },
});
