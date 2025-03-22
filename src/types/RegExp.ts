import { defineType } from "./TASONTypeInfo";

const regexpPattern = /^\/(.+)\/([gimnsxuy]*)$/;

export const RegExpTypeInfo = defineType({
  kind: "scalar",
  ctor: RegExp,
  serialize: value => {
    let s = value.toString();
    return s.replaceAll(/\\\//g, "/");
  },
  deserialize: value => {
    const match = value.match(regexpPattern);
    if (match) {
      let [_, pattern, flags] = match;
      for (const flag of flags) {
        if (["n", "x"].includes(flag)) {
          throw new TypeError(`Flag ${flag} is not supported`);
        }
      }
      return new RegExp(pattern, flags);
    } else {
      throw new TypeError(`Invalid RegExp: ${value}`);
    }
  },
});
