import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";
import { TASONType } from "@/types/metadata";

class User {
  name: string;
  friends: User[];

  constructor(name = "", friends: User[] = []) {
    this.name = name;
    this.friends = friends;
  }
}

const obj1 = {
  a: "dfgfd",
  c: new User("ss", [new User("foo", []), new User("bar", [])]),
  嗯嗯嗯啊啊啊: [0x45ab56n],
};

const obj1Str = `{
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
}`.replaceAll(/[\r\n]/g, "\n");

describe("stringify", () => {
  test("custom type", () => {
    const s = new TASON.Serializer({
      indent: false,
    });
    s.registry.registerType("User", {
      kind: "object",
      ctor: User,
    });

    expect(s.stringify(obj1)).toEqual(
      `{a:"dfgfd",` +
        `c:User({name:"ss",friends:[User({name:"foo",friends:[]}),User({name:"bar",friends:[]})]}),` +
        `"嗯嗯嗯啊啊啊":[BigInt("4565846")]}`,
    );
  });

  test("indent", () => {
    const s = new TASON.Serializer({
      indent: 4,
    });
    s.registry.registerType("User", {
      kind: "object",
      ctor: User,
    });
    const ret = s.stringify(obj1);

    expect(ret).toEqual(obj1Str.replaceAll(/  /g, "    "));
  });

  test("max depth", () => {
    const s = new TASON.Serializer({
      maxDepth: 199, // 实际应该大于循环次数99的2倍，因为User类每一个实例就有一层{}和一层[]
    });

    let user = new User("User0", []);
    for (let i = 1; i < 100; i++) {
      user = new User("User" + i, [user]);
    }

    expect(() => TASON.stringify(user)).toThrow();
    expect(() => s.stringify(user)).not.toThrow();
  });

  test("use builtin dictionary", () => {
    const s = new TASON.Serializer({
      useBuiltinDictionary: true,
      allowUnsafeTypes: true,
    });

    expect(s.stringify(new Map([["foo", "bar"]])))
      .toEqual(`Dictionary({keyValuePairs:[["foo","bar"]]})`);
    expect(TASON.stringify(new Map([["foo", "bar"]])))
      .toEqual(`{foo:"bar"}`);

    expect(s.stringify(new Map<any, any>([
      [Symbol.toStringTag, "bar"], 
      [true, "foo"]
    ])))
      .toEqual(`Dictionary({keyValuePairs:[[Symbol("Symbol.toStringTag"),"bar"],[true,"foo"]]})`);
    expect(TASON.stringify(new Map<any, any>([
      [Symbol.toStringTag, "bar"], 
      ["a", "b"]
    ]))).toEqual(`{a:"b"}`);

    expect(s.stringify(new Map([[{a:1}, new Map([[1,2]])]])))
      .toEqual(`Dictionary({keyValuePairs:[[{a:1},Dictionary({keyValuePairs:[[1,2]]})]]})`);
  });

  test("鸭子类型 - metadata", () => {
    @TASONType("User", { kind: "object" })
    class AnotherUser {
      name: string;
      friends: AnotherUser[];

      constructor(name = "", friends: AnotherUser[] = []) {
        this.name = name;
        this.friends = friends;
      }
    }

    const s = new TASON.Serializer({});
    s.registry.registerType("User", {
      kind: "object",
      ctor: User,
    });
    expect(s.stringify(new AnotherUser("foo", [new User("bar")])))
      .toEqual(`User({name:"foo",friends:[User({name:"bar",friends:[]})]})`);
  });
});
