import { defineType } from "./TASONTypeInfo";

export class JSON {
  readonly jsonString: string;
  constructor(jsonString: string, subType: "object" | "array" | "" = "") {
    this.jsonString = jsonString.trim();
    if (subType === "array" && !this.jsonString.startsWith("[")) {
      throw new TypeError(`value is not a valid JSONArray`);
    }
    if (subType === "object" && !this.jsonString.startsWith("{")) {
      throw new TypeError(`value is not a valid JSONObject`);
    }

    // 仅检查是否合法
    globalThis.JSON.parse(this.jsonString);
  }

  toString() {
    return this.jsonString;
  }

  toJSON() {
    return globalThis.JSON.parse(this.jsonString);
  }
}

export default {
  JSON: defineType({
    kind: "scalar",
    ctor: JSON,
    serialize: value => value.jsonString,
    deserialize: value => new JSON(value, ""),
  }),
  JSONArray: defineType({
    kind: "scalar",
    ctor: JSON,
    serialize: value => value.jsonString,
    deserialize: value => new JSON(value, "array"),
  }),
  JSONObject: defineType({
    kind: "scalar",
    ctor: JSON,
    serialize: value => value.jsonString,
    deserialize: value => new JSON(value, "object"),
  }),
};
