import { defineType } from "./TASONTypeInfo";



const DateTypeInfo = defineType({
  kind: "scalar",
  ctor: Date,
  serialize: (value) => value.toISOString(),
  deserialize: (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError(`Invalid Date: ${value}`);
    }
    return date;
  },
});

export class Timestamp {
  readonly time: number;

  constructor(time: number | Date) {
    this.time = time instanceof Date ? time.getTime() : time;
  }

  toDate() {
    return new Date(this.time);
  }
}

const TimestampTypeInfo = defineType({
  kind: "scalar",
  ctor: Timestamp,
  serialize: (value) => value.time.toString(),
  deserialize: (value) => {
    const time = Number(value);
    if (Number.isNaN(time)) {
      throw new TypeError(`Invalid Timestamp: ${value}`);
    }
    return new Timestamp(time);
  },
});

export default {
  Date: DateTypeInfo,
  Timestamp: TimestampTypeInfo,
};