import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";

class User {
  name: string;
  friends: User[];

  constructor(name = "", friends: User[] = []) {
    this.name = name;
    this.friends = friends;
  }
}

const p = {
  a: "dfgfd",
  c: new User("ss", [new User("foo", []), new User("bar", [])]),
  嗯嗯嗯啊啊啊: [0x45ab56n],
};

describe("stringify", () => {
  test("custom type", () => {
    const s = new TASON.Serializer({
      indent: false,
    });
    s.registry.registerType("User", {
      kind: "object",
      ctor: User,
    });

    expect(s.stringify(p)).toEqual(
      `{a: "dfgfd",` +
        `c: User({name: "ss",friends: [User({name: "foo",friends: []}),User({name: "bar",friends: []})]}),` +
        `"嗯嗯嗯啊啊啊": [BigInt("4565846")]}`,
    );
  });

  test("indent", () => {
    const s2 = new TASON.Serializer({
      indent: 2,
    });
    s2.registry.registerType("User", {
      kind: "object",
      ctor: User,
    });
    const ret = s2.stringify(p);
    console.log(ret);

    expect(ret).toEqual(
      `{
  a: "dfgfd",
  c: User({
    name: "ss",
    friends: [
      User({
        name: "foo",
        friends: []
      }),
      User({
        name: "bar",
        friends: []
      })
    ]
  }),
  "嗯嗯嗯啊啊啊": [
    BigInt("4565846")
  ]
}`.replaceAll(/[\r\n]/g, "\n"),
    );
  });
});
