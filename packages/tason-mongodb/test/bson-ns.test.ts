import { describe, expect, test } from "@jest/globals";
import type { Long as LongClass } from "bson";
import mongoose from "mongoose";
import TASON from "tason";
import {
  getBson,
  MongoTypes,
  registerMongoDBTypes,
} from "../src";
import { testBson } from "./test-bson";

function createSerializer() {
  return new TASON.Serializer({ indent: false });
}

describe("bson holder", () => {
  test("omitting bson binds loadDefaultBson", () => {
    const s = createSerializer();
    registerMongoDBTypes(s.registry, {
      replaceDefaultImplementation: { Int64: true },
    });
    expect(getBson().Long).toBe(testBson.Long);
    expect(s.parse(`Int64("1")`)).toBeInstanceOf(testBson.Long);
  });

  test("register binds holder; MongoTypes.ctor follows", () => {
    const s = createSerializer();
    registerMongoDBTypes(s.registry, {
      bson: mongoose.mongo as import("../src").BsonNamespace,
      replaceDefaultImplementation: { Int64: true },
    });
    expect(getBson().Long).toBe(mongoose.mongo.Long);
    expect((MongoTypes.Int64 as { ctor: unknown }).ctor).toBe(
      mongoose.mongo.Long,
    );
    expect(s.registry.getDefaultType("Int64")!.ctor).toBe(mongoose.mongo.Long);
    expect(s.parse(`Int64("1")`)).toBeInstanceOf(mongoose.mongo.Long);
  });

  test("re-register replaces ctor on the same TypeInfo objects", () => {
    class FakeLong {
      _bsontype = "Long" as const;
      constructor(private readonly text: string) {}
      static fromString(value: string) {
        return new FakeLong(value);
      }
      toString() {
        return this.text;
      }
    }

    const info = MongoTypes.Int64 as { ctor: unknown };
    const s = createSerializer();
    registerMongoDBTypes(s.registry, {
      bson: { ...testBson, Long: FakeLong as unknown as typeof LongClass },
      replaceDefaultImplementation: { Int64: true },
    });
    expect(info.ctor).toBe(FakeLong);
    expect(getBson().Long).toBe(FakeLong);
    const parsed = s.parse(`Int64("9")`);
    expect(parsed).toBeInstanceOf(FakeLong);
    expect(String(parsed)).toBe("9");

    registerMongoDBTypes(s.registry, {
      bson: testBson,
      replaceDefaultImplementation: { Int64: true },
    });
    expect(info.ctor).toBe(testBson.Long);
    expect(s.parse(`Int64("9")`)).toBeInstanceOf(testBson.Long);
  });
});
