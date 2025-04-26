import { defineType } from "./TASONTypeInfo";
import { format, formatISO, formatRFC3339 } from "date-fns";
import { utc } from "@date-fns/utc";

export const StandardFormat = "yyyy-MM-ddTHH:mm:ss.SSSZ";

export const StandardDateFormat = "yyyy-MM-dd";

export const StandardTimeFormat = "HH:mm:ss.SSS";


const DateTypeInfo = defineType({
  kind: "scalar",
  ctor: Date,
  serialize: (value) => formatRFC3339(value, { 
    fractionDigits: 3,
    in: utc
  }),
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
    if (time instanceof Date) {
      time = time.getTime();
    }
    
    if (Number.isNaN(time) || !Number.isFinite(time)) {
      throw new TypeError(`Invalid timestamp: ${time}`);
    }
    this.time = time;
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


export class DateOnly {
  readonly date: Date;

  constructor(date: Date) {
    this.date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  toString(): string {
    return formatISO(this.date, { representation: "date" });
  }
}

const DateOnlyTypeInfo = defineType({
  kind: "scalar",
  ctor: DateOnly,
  serialize: (value) => value.toString(),
  deserialize: (value) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new TypeError(`Invalid DateOnly: ${value}`);
    }
    return new DateOnly(date);
  }
});


export class TimeOnly {
  readonly time: Date;

  constructor(time: Date) {
    this.time = new Date(1970, 0, 1, time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
  }

  toString(): string {
    return format(this.time, StandardTimeFormat);
  }

}

const TimeOnlyTypeInfo = defineType<TimeOnly>({
  kind: "scalar",
  ctor: TimeOnly,
  serialize: (value) => value.toString(),
  deserialize: (value) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new TypeError(`Invalid TimeOnly: ${value}`);
    }
    return new TimeOnly(date);
  },
});

export default {
  Date: DateTypeInfo,
  Timestamp: TimestampTypeInfo,
  DateOnly: DateOnlyTypeInfo,
  TimeOnly: TimeOnlyTypeInfo,
};