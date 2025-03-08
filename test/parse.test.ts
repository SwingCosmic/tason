import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { Decimal128, UInt8 } from "@/types/numbers";

class User {
  name: string;
  friends: User[];

  constructor(name = "", friends: User[] = []) {
    this.name = name;
    this.friends = friends;
  }
}

describe("parse", () => {
  test("custom type", () => {
    const s = new TASON.Serializer();
    s.registry.registerType("User", {
      kind: "object",
      ctor: User,
    });
    const p = s.parse(
      `
{ 
  a: 'dfgfd', 
  '嗯嗯嗯啊啊啊': [
    BigInt('0x45ab56'),
  ], 
  c: User({
    name: "ss",
    friends: [
      User({
        name: "foo",
        friends: []
      }),
      User({
        name: "bar",
      }),
    ],
  }),
}
`
    );
    expect(p).toEqual({
      a: "dfgfd",
      嗯嗯嗯啊啊啊: [0x45ab56n],
      c: new User("ss", [
        new User("foo", []),
        new User("bar", []),
      ]),
    });
  });

  test("null prototype object", () => {
    const s = new TASON.Serializer({
      nullPrototypeObject: true,
    });

    expect(Object.getPrototypeOf(s.parse("{ a: 1 }"))).toEqual(null);
    const s2 = new TASON.Serializer({
      nullPrototypeObject: false,
    });

    expect(Object.getPrototypeOf(s2.parse("{ a: 1 }"))).toEqual(
      Object.prototype
    );
  });

  test("allow duplicated keys", () => {
    const s = new TASON.Serializer({
      allowDuplicatedKeys: true,
    });

    expect(s.parse(`{a:1, a:2}`)).toEqual({ a: 2 });
    const s2 = new TASON.Serializer({
      allowDuplicatedKeys: false,
    });

    expect(() => s2.parse(`{a:1, a:2}`)).toThrow();
  });

  test("别名", () => {
    const s = new TASON.Serializer();
    s.registry.registerTypeAlias("Decimal", "Decimal128");
    expect(s.parse(`Decimal("33.455")`)).toEqual(new Decimal128("33.455"));

    expect(s.parse(`Byte("120")`)).toEqual(new UInt8("120"));
  });
});
