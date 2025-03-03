import { v4 as uuidv4 } from "uuid";
import { defineType } from "./TASONTypeInfo";

const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UUID {
  readonly value: string;
  constructor(value: string) {
    if (!pattern.test(value)) {
      throw new TypeError(`Invalid UUID: ${value}`);
    }
    this.value = value;
  }

  static new(): UUID {
    return new UUID(uuidv4());
  }
}

export const UUIDTypeInfo = defineType({
  kind: "scalar",
  ctor: UUID,
  serialize: value => value.value,
  deserialize: value => new UUID(value),
});
