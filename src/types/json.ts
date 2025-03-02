import { TASONTypeDiscriminator, TypeDiscriminatorKey } from "./metadata";
import { defineType } from "./TASONTypeInfo";

export class JSON implements TASONTypeDiscriminator {
  readonly jsonString: string;
  readonly subType: "object" | "array" | "";
  constructor(jsonString: string, subType: "object" | "array" | "" = "") {
    this.jsonString = jsonString.trim();
    this.subType = subType;
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

  toJSONValue() {
    return globalThis.JSON.parse(this.jsonString);
  }

  [TypeDiscriminatorKey]() {
    return this.subType === "array"
      ? "JSONArray"
      : this.subType === "object"
      ? "JSONObject"
      : "JSON";
  }
}

export default {
  JSON: defineType({
    kind: "scalar",
    ctor: JSON,
    serialize: value => value.toString(),
    deserialize: value => new JSON(value, ""),
  }),
  JSONArray: defineType({
    kind: "scalar",
    ctor: JSON,
    serialize: value => value.toString(),
    deserialize: value => new JSON(value, "array"),
  }),
  JSONObject: defineType({
    kind: "scalar",
    ctor: JSON,
    serialize: value => value.toString(),
    deserialize: value => new JSON(value, "object"),
  }),
};
