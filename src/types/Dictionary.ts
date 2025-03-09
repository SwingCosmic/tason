import { defineType } from "./TASONTypeInfo";

export interface MapStore<K = any, V = any> {
  keyValuePairs: [K, V][];
}

export const DictionaryTypeInfo = defineType({
  kind: "object",
  ctor: Map,
  serialize: (value, options) => {
    let keyValuePairs = Array.from(value.entries()).filter(p => {
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
      keyValuePairs,
    } as MapStore;
  },
  deserialize: (value: MapStore) => {
    const entries = value.keyValuePairs;
    return new Map(entries);
  },
});
