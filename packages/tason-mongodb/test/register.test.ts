import { describe, expect, test } from "@jest/globals";
import { Binary } from "bson";
import TASON from "tason";
import {
  ALL_MONGO_TYPE_NAMES,
  MongoTypeCatalog,
  MongoTypes,
  registerMongoDBTypes,
} from "../src";

/**
 * 注册入口：catalog / 未知 include / 追加实现
 */

function createSerializer() {
  return new TASON.Serializer({ indent: false });
}

describe("registerMongoDBTypes", () => {
  test("Buffer appends Binary implementation", () => {
    const s = createSerializer();
    const before = s.registry.getDefaultType("Buffer");
    expect(registerMongoDBTypes(s.registry)).toBe(s.registry);
    // 未 replaceDefault：默认仍是核心 Buffer，追加 bson.Binary
    expect(s.registry.getDefaultType("Buffer")).toBe(before);
    expect(s.registry.getAllTypes("Buffer")).toHaveLength(2);
    expect(s.registry.getDefaultType("MD5")!.ctor).toBe(Binary);
  });

  test("unknown include", () => {
    const s = createSerializer();
    expect(() =>
      registerMongoDBTypes(s.registry, {
        include: ["NotAMongoType" as any],
      }),
    ).toThrow(/Unknown MongoDB type/);
  });

  test("catalog names", () => {
    // 内部语义用 BSON 前缀；不占用核心 Timestamp / MinKey / MaxKey / Code / Binary
    expect(ALL_MONGO_TYPE_NAMES).toEqual(
      expect.arrayContaining([
        "ObjectId",
        "BSONMinKey",
        "BSONMaxKey",
        "BSONTimestamp",
        "BSONJavaScript",
        "Int64",
        "Decimal128",
        "Buffer",
        "UUID",
        "MD5",
      ]),
    );
    for (const name of [
      "Timestamp",
      "BsonTimestamp",
      "MinKey",
      "MaxKey",
      "Binary",
      "Code",
    ]) {
      expect(ALL_MONGO_TYPE_NAMES).not.toContain(name);
    }
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "Int64"),
    ).toMatchObject({ strategy: "append", canReplaceDefault: true });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "BSONJavaScript"),
    ).toMatchObject({ strategy: "new", unsafe: true });
    expect(Object.keys(MongoTypes)).toEqual(
      expect.arrayContaining([
        "ObjectId",
        "BSONMinKey",
        "BSONMaxKey",
        "BSONTimestamp",
        "BSONJavaScript",
        "Int64",
        "Decimal128",
        "Int32",
        "Float64",
        "UUID",
        "Buffer",
        "MD5",
        "BSONEncrypted",
        "BSONSensitive",
        "BSONVector",
      ]),
    );
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "Buffer"),
    ).toMatchObject({ strategy: "append", canReplaceDefault: true });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "BSONVector"),
    ).toMatchObject({ strategy: "new" });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "BSONVector"),
    ).not.toHaveProperty("canReplaceDefault");
  });
});
