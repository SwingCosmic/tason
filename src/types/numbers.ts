import Decimal from "decimal.js";
import { Constructor } from "type-fest";
import { defineType, TASONTypeInfo } from "./TASONTypeInfo";

export interface INumber<T> {
  readonly value: T;
  toString(): string;
}

export interface INumberConstructor<T extends INumber<N>, N> {
  readonly MIN_VALUE: N;
  readonly MAX_VALUE: N;
  readonly BYTE_SIZE: number;
  readonly UNSIGNED: boolean;
  new (value: string): T;
}

type AllowRadix = 2 | 8 | 16 | 10;

function getNumberWithRadix(n: string): { value: string; radix: AllowRadix } {
  let original = n;
  let isNegative = false;
  if(n.startsWith("-")) {
    n = n.slice(1);
    isNegative = true;
  }

  const prefix = n.slice(0, 2);
  let radix: AllowRadix = 10;
  let value = (isNegative ? "-" : "")  + n.substring(2);
  switch (prefix) {
    case "0b":
      radix = 2;
      break;
    case "0o":
      radix = 8;
      break;
    case "0x":
      radix = 16;
      break;
    default:
      radix = 10;
      value = original;
      break;
  }
  return { value, radix };
}

function checkDigit(value: string): true {
  if (value.includes(".") && value.at(-1) !== ".") {
    throw new Error(`${value} is not an integer`);
  }
  return true;
}

abstract class NumberBase<T> implements INumber<T> {
  readonly value: T;

  abstract parseValue(value: string, radix: AllowRadix): T;
  /** 检查数值是否溢出并截断。不同于CPU运算时整数类型的溢出，此处截断不根据二进制表示处理。
   * 例如 `Int16.MAX_VALUE` = 32767，那么32768会溢出，截断为32767而不是-32767。
   */
  abstract clampValue(value: T): [boolean, T];

  constructor(value: string, clamp = false) {
    const { value: v, radix } = getNumberWithRadix(value);
    const n = this.parseValue(v, radix);
    const [success, clampValue] = this.clampValue(n);
    if (!success && !clamp) {
      throw new Error(`Invalid value: ${value}`);
    }
    this.value = clampValue;
  }

  toString(): string {
    return String(this.value);
  }

  valueOf(): T {
    return this.value;
  }

  private get _SubClass() {
    return this.constructor as INumberConstructor<INumber<T>, T>;
  }

  sizeOf() {
    return this._SubClass.BYTE_SIZE;
  }

  equals(other: INumber<T>): boolean {
    return this.value === other.value;
  }
}

export class Byte extends NumberBase<number> {
  clampValue(value: number): [boolean, number] {
    let success = true;
    if (value < Byte.MIN_VALUE) {
      value = Byte.MIN_VALUE;
      success = false;
    } else if (value > Byte.MAX_VALUE) {
      value = Byte.MAX_VALUE;
      success = false;
    }
    return [success, value];
  }
  parseValue(value: string, radix: AllowRadix): number {
    return checkDigit(value) && parseInt(value, radix);
  }

  static readonly MIN_VALUE: number = 0;
  static readonly MAX_VALUE: number = 2 ** 8 - 1;
  static readonly BYTE_SIZE: number = 1;
  static readonly UNSIGNED: boolean = true;
}

export class Int16 extends NumberBase<number> {
  clampValue(value: number): [boolean, number] {
    let success = true;
    if (value < Int16.MIN_VALUE) {
      value = Int16.MIN_VALUE;
      success = false;
    } else if (value > Int16.MAX_VALUE) {
      value = Int16.MAX_VALUE;
      success = false;
    }
    return [success, value];
  }

  parseValue(value: string, radix: AllowRadix): number {
    return checkDigit(value) && parseInt(value, radix);
  }

  static readonly MIN_VALUE: number = -(2 ** 15);
  static readonly MAX_VALUE: number = 2 ** 15 - 1;
  static readonly BYTE_SIZE: number = 2;
  static readonly UNSIGNED: boolean = false;
}

export class Int32 extends NumberBase<number> {
  clampValue(value: number): [boolean, number] {
    let success = true;
    if (value < Int32.MIN_VALUE) {
      value = Int32.MIN_VALUE;
      success = false;
    } else if (value > Int32.MAX_VALUE) {
      value = Int32.MAX_VALUE;
      success = false;
    }
    return [success, value];
  }
  parseValue(value: string, radix: AllowRadix): number {
    return checkDigit(value) && parseInt(value, radix);
  }

  static readonly MIN_VALUE: number = -(2 ** 31);
  static readonly MAX_VALUE: number = 2 ** 31 - 1;
  static readonly BYTE_SIZE: number = 4;
  static readonly UNSIGNED: boolean = false;
}

export class Int64 extends NumberBase<bigint> {
  clampValue(value: bigint): [boolean, bigint] {
    let success = true;
    if (value < Int64.MIN_VALUE) {
      value = Int64.MIN_VALUE;
      success = false;
    } else if (value > Int64.MAX_VALUE) {
      value = Int64.MAX_VALUE;
      success = false;
    }
    return [success, value];
  }
  parseValue(value: string, radix: AllowRadix): bigint {
    checkDigit(value);

    if (radix == 16) {
      return BigInt("0x" + value);
    } else if (radix == 10) {
      return BigInt(value);
    } else {
      const d = new Decimal((radix == 8 ? "0o" : "0b") + value);
      return BigInt(d.toString());
    }
  }

  static readonly MIN_VALUE: bigint = -(2n ** 63n);
  static readonly MAX_VALUE: bigint = 2n ** 63n - 1n;
  static readonly BYTE_SIZE: number = 8;
  static readonly UNSIGNED: boolean = false;
}

export class Float32 extends NumberBase<number> {
  // 浮点数永不溢出
  clampValue(value: number): [boolean, number] {
    if (value < Float32.MIN_VALUE) {
      value = -Infinity;
    } else if (value > Float32.MAX_VALUE) {
      value = Infinity;
    }
    return [true, value];
  }

  parseValue(value: string, radix: AllowRadix): number {
    if (radix !== 10) {
      throw new Error(`Unsupported radix: ${radix}`);
    }
    return parseFloat(value);
  }

  static readonly MIN_VALUE: number = -3.4028235e+38;
  static readonly MAX_VALUE: number = 3.4028235e+38;
  static readonly BYTE_SIZE: number = 4;
  static readonly UNSIGNED: boolean = false;
}

export class Float64 extends NumberBase<number> {
  clampValue(value: number): [boolean, number] {
    return [true, value];
  }

  parseValue(value: string, radix: AllowRadix): number {
    if (radix !== 10) {
      throw new Error(`Unsupported radix: ${radix}`);
    }
    return parseFloat(value);
  }

  static readonly MIN_VALUE: number = Number.MIN_VALUE;
  static readonly MAX_VALUE: number = Number.MAX_VALUE;
  static readonly BYTE_SIZE: number = 8;
  static readonly UNSIGNED: boolean = false;
}

export class Decimal128 extends NumberBase<Decimal> {
  clampValue(value: Decimal): [boolean, Decimal] {
    let success = true;
    if (value.lt(Decimal128.MIN_VALUE)) {
      value = new Decimal(Decimal128.MIN_VALUE);
      success = false;
    } else if (value.gt(Decimal128.MAX_VALUE)) {
      value = new Decimal(Decimal128.MAX_VALUE);
      success = false;
    }
    return [success, value];
  }

  parseValue(value: string): Decimal {
    return new Decimal(value);
  }

  override equals(other: INumber<Decimal>): boolean {
    return other.value.equals(this.value);
  }

  static readonly MIN_VALUE: Decimal = new Decimal((-(2n ** 96n) + 1n).toString());
  static readonly MAX_VALUE: Decimal = new Decimal((2n ** 96n - 1n).toString());
  static readonly BYTE_SIZE: number = 16;
  static readonly UNSIGNED: boolean = false;

}

const Numbers = {
  Byte: Byte as INumberConstructor<Byte, number>,
  Int16: Int16 as INumberConstructor<Int16, number>,
  Int32: Int32 as INumberConstructor<Int32, number>,
  Int64: Int64 as INumberConstructor<Int64, bigint>,
  Float32: Float32 as INumberConstructor<Float32, number>,
  Float64: Float64 as INumberConstructor<Float64, number>,
  Decimal128: Decimal128 as INumberConstructor<Decimal128, Decimal>,
};

export default Numbers;

type NumbersType = typeof Numbers;
export function defineNumbers(): { [K in keyof NumbersType]: TASONTypeInfo<NumbersType[K]> } {
  const ret: any = {};
  for (const [name, type] of Object.entries(Numbers)) {
    ret[name] = defineType({
      kind: "scalar",
      ctor: type as Constructor<any>,
      serialize: (value) => value.toString(),
    });
  }
  return ret;
}