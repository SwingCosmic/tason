import { describe, expect, test } from "@jest/globals";
import { Long } from "bson";
import TASON from "tason";
import {
  ALL_MONGO_TYPE_NAMES,
  MongoTypeCatalog,
  MongoTypes,
} from "../src";
import { registerMongo, testBson } from "./test-bson";

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
    expect(registerMongo(s.registry)).toBe(s.registry);
    // 未 replaceDefault：默认仍是核心 Buffer，追加 bson.Binary
    expect(s.registry.getDefaultType("Buffer")).toBe(before);
    expect(s.registry.getAllTypes("Buffer")).toHaveLength(2);
    expect(s.registry.getDefaultType("MD5")!.ctor).toBe(testBson.Binary);
  });

  test("repeated registration is idempotent", () => {
    const s = createSerializer();
    registerMongo(s.registry);
    const sizes = Object.fromEntries(
      ALL_MONGO_TYPE_NAMES.map((n) => [n, s.registry.getAllTypes(n).length]),
    );

    // 第二次调用按 ctor 幂等更新：不堆积、不改默认
    registerMongo(s.registry);
    for (const [name, size] of Object.entries(sizes)) {
      expect(s.registry.getAllTypes(name)).toHaveLength(size);
    }
    expect(s.parse(`Int64("1")`)).toBe(1n);

    // 第二次带 replaceDefault：默认切换且仍不堆积
    registerMongo(s.registry, {
      replaceDefaultImplementation: { Int64: true },
    });
    expect(s.registry.getAllTypes("Int64")).toHaveLength(sizes.Int64);
    expect(s.parse(`Int64("1")`)).toBeInstanceOf(Long);
  });

  test("unknown include", () => {
    const s = createSerializer();
    expect(() =>
      registerMongo(s.registry, {
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
