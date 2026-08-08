import { defineType } from "@/TASONTypeInfo";

export interface MapStore<K = any, V = any> {
  pairs: [K, V][];
}

export const DictionaryTypeInfo = defineType({
  kind: "object",
  ctor: Map,
  serialize: (value, options) => {
    const pairs: [unknown, unknown][] = [];
    for (const [k, v] of value.entries()) {
      if (typeof k === "function" || typeof v === "function") {
        continue;
      }
      // symbol 一旦进入 Dictionary 序列化路径：无 allowUnsafeTypes 必须报错（不可静默丢弃）
      if (typeof k === "symbol" || typeof v === "symbol") {
        if (!options.allowUnsafeTypes) {
          throw new Error(
            `Cannot serialize symbol as Map/Dictionary key or value when allowUnsafeTypes is false`,
          );
        }
      }
      pairs.push([k, v]);
    }

    return {
      pairs,
    } as MapStore;
  },
  deserialize: (value: MapStore) => {
    const entries = value.pairs;
    return new Map(entries);
  },
});
