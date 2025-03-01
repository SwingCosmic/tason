import { defineType } from "./TASONTypeInfo";

const regexpPattern = /^\/(.+)\/([gimsuy]*)$/;

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
      return new RegExp(match[1], match[2]);
    } else {
      throw new TypeError(`Invalid RegExp: ${value}`);
    }
  },
});
