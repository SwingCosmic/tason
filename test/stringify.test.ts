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
      .toEqual(`Dictionary({pairs:[["foo","bar"]]})`);
    expect(TASON.stringify(new Map([["foo", "bar"]])))
      .toEqual(`{foo:"bar"}`);

    expect(s.stringify(new Map<any, any>([
      [Symbol.toStringTag, "bar"], 
      [true, "foo"]
    ])))
      .toEqual(`Dictionary({pairs:[[Symbol("Symbol.toStringTag"),"bar"],[true,"foo"]]})`);
    expect(TASON.stringify(new Map<any, any>([
      [Symbol.toStringTag, "bar"], 
      ["a", "b"]
    ]))).toEqual(`{a:"b"}`);

    expect(s.stringify(new Map([[{a:1}, new Map([[1,2]])]])))
      .toEqual(`Dictionary({pairs:[[{a:1},Dictionary({pairs:[[1,2]]})]]})`);
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


  test("Null Property", () => {
    const s = new TASON.Serializer({});

    const obj = {
      a: 1,
      b: null,
      c: undefined,
      d: 4,
      e: [5, null, null, 7, null],
      f: undefined,
      g: 10,
    };

    expect(s.stringify(obj)).toEqual(`{a:1,b:null,c:null,d:4,e:[5,null,null,7,null],f:null,g:10}`);

    const s2 = new TASON.Serializer({
      nullPropertyHandling: "ignore",
    });

    expect(s2.stringify(obj)).toEqual(`{a:1,d:4,e:[5,null,null,7,null],g:10}`);
  });
});
