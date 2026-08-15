import { describe, expect, test } from "@jest/globals";
import * as v from "valibot";
import TASON, { createValibotAdapter, defineType } from "@/index";
import { Int64 } from "@/types/numbers";
import { TypeDiscriminatorKey } from "@/metadata";

/**
 * 同一 TypeName 多实现：默认实现 / parseAs / clone
 */

function createSerializer(
  options: ConstructorParameters<typeof TASON.Serializer>[0] = {},
) {
  return new TASON.Serializer({ indent: false, ...options });
}

class FakeLong {
  readonly value: bigint;
  constructor(arg: string) {
    this.value = BigInt(arg);
  }
  toString() {
    return this.value.toString();
  }
}

const fakeLongInfo = defineType<FakeLong>({
  kind: "scalar",
  ctor: FakeLong,
  serialize: (value) => value.toString(),
});

class User {
  id!: bigint;
  name!: string;
  constructor(init?: Partial<User>) {
    if (init) Object.assign(this, init);
  }
}

const UserSchema = v.object({
  id: v.bigint(),
  name: v.string(),
});

class Animal {
  kind!: string;
  constructor(init?: Partial<Animal>) {
    if (init) Object.assign(this, init);
  }
}

class Dog extends Animal {
  breed!: string;
  constructor(init?: Partial<Dog>) {
    super(init);
    if (init) Object.assign(this, init);
  }
  [TypeDiscriminatorKey]() {
    return "Dog";
  }
}

describe("multi implementation", () => {
  describe("default implementation", () => {
    test("setDefaultType and asDefault change parse default", () => {
      const s = createSerializer({ deserializeNumberHandling: "all" });
      s.registry.registerType("Int64", fakeLongInfo, undefined, {
        asDefault: true,
      });
      expect(s.parse(`Int64("1")`)).toBeInstanceOf(FakeLong);
      expect((s.parse(`Int64("1")`) as FakeLong).value).toBe(1n);

      const s2 = createSerializer({ deserializeNumberHandling: "all" });
      s2.registry.setDefaultType("Int64", fakeLongInfo);
      expect(s2.parse(`Int64("1")`)).toBeInstanceOf(FakeLong);
    });

    test("append implementation keeps original parse default", () => {
      const s = createSerializer({ deserializeNumberHandling: "all" });
      s.registry.registerType("Int64", fakeLongInfo);
      const parsed = s.parse(`Int64("1")`);
      expect(parsed).toBeInstanceOf(Int64);
      expect(parsed).not.toBeInstanceOf(FakeLong);
    });

    test("clone preserves default implementation order", () => {
      const s = createSerializer({ deserializeNumberHandling: "all" });
      s.registry.setDefaultType("Int64", fakeLongInfo);
      const cloned = s.registry.clone();
      expect(cloned.getDefaultType("Int64")!.ctor).toBe(FakeLong);

      const s2 = createSerializer({
        deserializeNumberHandling: "all",
        registry: cloned,
      });
      expect(s2.parse(`Int64("1")`)).toBeInstanceOf(FakeLong);
    });

    test("default switch stays stable across ser/de rounds", () => {
      const s = createSerializer({
        serializeNumberHandling: "all",
        deserializeNumberHandling: "all",
      });
      s.registry.setDefaultType("Int64", fakeLongInfo);

      const first = s.parse(`Int64("6571037680684232705")`) as FakeLong;
      expect(first).toBeInstanceOf(FakeLong);
      const text = s.stringify(first);
      expect(text).toBe(`Int64("6571037680684232705")`);
      const again = s.parse(text);
      expect(again).toBeInstanceOf(FakeLong);
      expect((again as FakeLong).value).toBe(6571037680684232705n);
    });
  });

  describe("append implementation stringify", () => {
    test("stringify recognizes additional implementation instance", () => {
      const s = createSerializer({ serializeNumberHandling: "all" });
      s.registry.registerType("Int64", fakeLongInfo);
      expect(s.stringify(new FakeLong("42"))).toBe(`Int64("42")`);
    });
  });

  describe("builtin without default change", () => {
    test("builtin Int64 parse and stringify unchanged", () => {
      const s = createSerializer();
      s.registry.registerType("Int64", fakeLongInfo);
      expect(s.parse(`Int64("1")`)).toBe(1n);

      const keep = createSerializer({ deserializeNumberHandling: "all" });
      keep.registry.registerType("Int64", fakeLongInfo);
      expect(keep.parse(`Int64("1")`)).toEqual(new Int64("1"));
    });
  });

  describe("parseAs", () => {
    test("selects implementation for one call without changing default", () => {
      const s = createSerializer({ deserializeNumberHandling: "all" });
      s.registry.registerType("Int64", fakeLongInfo);

      const once = s.parseAs(FakeLong, `Int64("1")`);
      expect(once).toBeInstanceOf(FakeLong);
      expect(once.value).toBe(1n);

      expect(s.parse(`Int64("1")`)).toBeInstanceOf(Int64);
      expect(s.registry.getDefaultType("Int64")!.ctor).toBe(Int64);
    });

    test("ObjectType plus schema", () => {
      const s = createSerializer();
      s.registry.setSchemaAdapter(createValibotAdapter());
      s.registry.registerType(
        "User",
        { kind: "object", ctor: User },
        { schema: UserSchema },
      );

      const u = s.parseAs(User, `User({id:Int64("1"),name:"Ada"})`);
      expect(u).toBeInstanceOf(User);
      expect(u.id).toBe(1n);
      expect(u.name).toBe("Ada");
    });

    test("discriminator subclass", () => {
      const s = createSerializer();
      s.registry.registerType("Animal", { kind: "object", ctor: Animal });
      s.registry.registerType("Dog", { kind: "object", ctor: Dog });

      const d = s.parseAs(Animal, `Dog({kind:"dog",breed:"corgi"})`);
      expect(d).toBeInstanceOf(Dog);
      expect((d as Dog).breed).toBe("corgi");

      const text = s.stringify(new Dog({ kind: "dog", breed: "corgi" }));
      expect(text.startsWith("Dog(")).toBe(true);
      expect(s.parse(text)).toBeInstanceOf(Dog);
    });

    test("match selects TypeName when implementations share a ctor", () => {
      class Tagged {
        constructor(public tag: string) {}
      }
      const s = createSerializer();
      s.registry.registerType("A", {
        kind: "scalar",
        ctor: Tagged,
        match: (v) => v.tag === "a",
        serialize: (v) => v.tag,
        deserialize: (arg) => new Tagged(arg),
      });
      s.registry.registerType("B", {
        kind: "scalar",
        ctor: Tagged,
        match: (v) => v.tag === "b",
        serialize: (v) => v.tag,
        deserialize: (arg) => new Tagged(arg),
      });
      expect(s.stringify(new Tagged("a"))).toBe(`A("a")`);
      expect(s.stringify(new Tagged("b"))).toBe(`B("b")`);
      expect(s.parse(`A("a")`)).toEqual(new Tagged("a"));
    });

    test("getTypeInfoByCtor and unmatched parseAs", () => {
      const s = createSerializer();
      expect(s.registry.getTypeInfoByCtor("Int64", FakeLong)).toBeUndefined();

      s.registry.registerType("Int64", fakeLongInfo);
      expect(s.registry.getTypeInfoByCtor("Int64", FakeLong)).toBe(fakeLongInfo);
      expect(s.registry.getTypeInfoByCtor("Int64", Int64)?.ctor).toBe(Int64);

      class Other {
        constructor(_arg?: string) {}
      }
      expect(() => s.parseAs(Other, `Int64("1")`)).toThrow(/No implementation/);
      expect(() => s.parseAs(FakeLong, `{x:1}`)).toThrow(/TypeInstance/);
    });
  });

  describe("setDefaultType unregistered", () => {
    test("registers then promotes when typeInfo is new", () => {
      const s = createSerializer({ deserializeNumberHandling: "all" });
      // 未在 Int64 列表中的全新实现：先注册再置顶
      s.registry.setDefaultType("Int64", fakeLongInfo);
      expect(s.registry.getDefaultType("Int64")!.ctor).toBe(FakeLong);
      expect(s.parse(`Int64("8")`)).toBeInstanceOf(FakeLong);

      expect(() =>
        s.registry.setDefaultTypeByCtor("Int64", class Missing {}),
      ).toThrow(/No implementation/);
      expect(() =>
        s.registry.setDefaultTypeByCtor("NoSuchType", FakeLong),
      ).toThrow(/not registered/);
    });
  });
});
