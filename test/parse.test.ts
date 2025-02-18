import { describe, expect, test } from "@jest/globals";
import TASON from "@/index";

class User {
  name = "";
  friends: User[] = [];
}

describe("parse", () => {
  test("value", () => {
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
`);
    expect(p).toEqual({
      a: "dfgfd",
      "嗯嗯嗯啊啊啊": [0x45ab56n],
      c: Object.setPrototypeOf({
        name: "ss",
        friends: [
          Object.setPrototypeOf({
            name: "foo",
            friends: []
          }, User.prototype),
          Object.setPrototypeOf({
            name: "bar",
            friends: []
          }, User.prototype),
        ],
      }, User.prototype),
    });
  })
})