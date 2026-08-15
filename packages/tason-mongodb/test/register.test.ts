import { describe, expect, test } from "@jest/globals";
import TASON, { type TASONTypeInfo } from "tason";
import {
  ALL_MONGO_TYPE_NAMES,
  MongoTypeCatalog,
  MongoTypes,
  registerMongoDBTypes,
} from "../src";

/**
 * 注册骨架：空表不改 registry；选项形状；未知 include
 */

function createSerializer() {
  return new TASON.Serializer({ indent: false });
}

describe("registerMongoDBTypes", () => {
  test("empty catalog is a no-op on registry", () => {
    const s = createSerializer();
    const before = s.registry.getDefaultType("Int64");
    const returned = registerMongoDBTypes(s.registry);
    expect(returned).toBe(s.registry);
    expect(s.registry.getDefaultType("Int64")).toBe(before);

    expect(() => s.parse(`ObjectId("6670f391dcb0bd791cb3bd18")`)).toThrow(
      /Unregistered type/,
    );
    expect(s.parse(`Int64("1")`)).toBe(1n);
  });

  test("accepts replaceDefaultImplementation shapes", () => {
    const s = createSerializer();
    expect(() =>
      registerMongoDBTypes(s.registry, { replaceDefaultImplementation: true }),
    ).not.toThrow();
    expect(() =>
      registerMongoDBTypes(s.registry, {
        replaceDefaultImplementation: { Int64: true, Decimal128: false },
      }),
    ).not.toThrow();
    expect(() =>
      registerMongoDBTypes(s.registry, { include: ["ObjectId", "Int64"] }),
    ).not.toThrow();
  });

  test("unknown include name", () => {
    const s = createSerializer();
    expect(() =>
      registerMongoDBTypes(s.registry, {
        include: ["NotAMongoType" as any],
      }),
    ).toThrow(/Unknown MongoDB type/);
  });

  test("catalog names cover P0 slots", () => {
    expect(ALL_MONGO_TYPE_NAMES).toEqual(
      expect.arrayContaining(["ObjectId", "Int64", "Decimal128"]),
    );
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "Int64"),
    ).toMatchObject({ strategy: "append", canReplaceDefault: true });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "ObjectId"),
    ).toMatchObject({ strategy: "new" });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "BSONTimestamp"),
    ).toMatchObject({ strategy: "new", wave: "C1" });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "BSONMinKey"),
    ).toMatchObject({ strategy: "new", wave: "C1" });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "Int64"),
    ).toMatchObject({ wave: "C2" });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "MD5"),
    ).toMatchObject({ wave: "C3" });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "Buffer"),
    ).toMatchObject({ strategy: "append", canReplaceDefault: true });
    expect(
      MongoTypeCatalog.find((spec) => spec.typeName === "BSONJavaScript"),
    ).toMatchObject({ strategy: "new", unsafe: true });
    expect(ALL_MONGO_TYPE_NAMES).not.toContain("Timestamp");
    expect(ALL_MONGO_TYPE_NAMES).not.toContain("BsonTimestamp");
    expect(ALL_MONGO_TYPE_NAMES).not.toContain("MinKey");
    expect(ALL_MONGO_TYPE_NAMES).not.toContain("MaxKey");
    expect(ALL_MONGO_TYPE_NAMES).not.toContain("Binary");
    expect(ALL_MONGO_TYPE_NAMES).not.toContain("Code");
    expect(ALL_MONGO_TYPE_NAMES).toEqual(
      expect.arrayContaining([
        "Buffer",
        "UUID",
        "MD5",
        "BSONEncrypted",
        "BSONSensitive",
        "BSONVector",
      ]),
    );
    expect(Object.keys(MongoTypes)).toHaveLength(0);
  });

  test("BSONJavaScript include requires allowUnsafeTypes", () => {
    const s = createSerializer();
    expect(() =>
      registerMongoDBTypes(s.registry, { include: ["BSONJavaScript"] }),
    ).toThrow(/allowUnsafeTypes/);

    const unsafe = new TASON.Serializer({ allowUnsafeTypes: true, indent: false });
    expect(() =>
      registerMongoDBTypes(unsafe.registry, { include: ["BSONJavaScript"] }),
    ).not.toThrow();
  });

  test("wired TypeInfo uses asDefault when requested", () => {
    class FakeOid {
      readonly hex: string;
      constructor(hex: string) {
        this.hex = hex;
      }
    }
    const oidInfo: TASONTypeInfo<FakeOid> = {
      kind: "scalar",
      ctor: FakeOid,
      serialize: (v) => v.hex,
    };
    const prev = MongoTypes.ObjectId;
    MongoTypes.ObjectId = oidInfo;
    try {
      const s = createSerializer();
      registerMongoDBTypes(s.registry, { include: ["ObjectId"] });
      expect(s.registry.getDefaultType("ObjectId")!.ctor).toBe(FakeOid);
      expect(s.parse(`ObjectId("6670f391dcb0bd791cb3bd18")`)).toBeInstanceOf(
        FakeOid,
      );
    } finally {
      if (prev) MongoTypes.ObjectId = prev;
      else delete MongoTypes.ObjectId;
    }
  });
});
