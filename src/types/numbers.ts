
import Decimal from "decimal.js";

interface INumber<T> {
  readonly value: T;
  toString(): string;
}

interface INumberConstructor<T extends INumber<N>, N> {
  readonly MIN_VALUE: N;
  readonly MAX_VALUE: N;
  readonly BYTE_SIZE: number;
  readonly UNSIGNED: boolean;
  new (value: string): T;
}

type AllowRadix = 2 | 8 | 16 | 10;

function getNumberWithRadix(n: string): { value: string; radix: AllowRadix } {
  const prefix = n.slice(0, 2);
  let radix: AllowRadix = 10;
  let value = n.substring(2);
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
      value = n;
      break;
  }
  return { value, radix };
}

abstract class NumberBase<T> implements INumber<T> {
  readonly value: T;

  abstract parseInt(value: string, radix: AllowRadix): T;
  abstract clampValue(value: T): [boolean, T];

  constructor(value: string, clamp = false) {
    const { value: v, radix } = getNumberWithRadix(value);
    const n = this.parseInt(v, radix);
    const [success, clampValue] = this.clampValue(n);
    if (!success && !clamp) {
      throw new Error(`Invalid value: ${value}`);
    }
    this.value = clampValue;
  }

  toString(): string {
    return String(this.value);
  }
}

class _Byte extends NumberBase<number> {
  clampValue(value: number): [boolean, number] {
    let success = true;
    if (value < _Byte.MIN_VALUE) {
      value = _Byte.MIN_VALUE;
      success = false;
    } else if (value > _Byte.MAX_VALUE) {
      value = _Byte.MAX_VALUE;
      success = false;
    }
    return [success, value];
  }
  parseInt(value: string, radix: AllowRadix): number {
    return parseInt(value, radix);
  }

  static readonly MIN_VALUE: number = 0;
  static readonly MAX_VALUE: number = 2 ** 8 - 1;
  static readonly BYTE_SIZE: number = 1;
  static readonly UNSIGNED: boolean = true;
}
export const Byte: INumberConstructor<_Byte, number> = _Byte;


class _Int32 extends NumberBase<number> {
  clampValue(value: number): [boolean, number] {
    let success = true;
    if (value < _Int32.MIN_VALUE) {
      value = _Int32.MIN_VALUE;
      success = false;
    } else if (value > _Int32.MAX_VALUE) {
      value = _Int32.MAX_VALUE;
      success = false;
    }
    return [success, value];
  }
  parseInt(value: string, radix: AllowRadix): number {
    return parseInt(value, radix);
  }

  static readonly MIN_VALUE: number = -(2 ** 31);
  static readonly MAX_VALUE: number = 2 ** 31 - 1;
  static readonly BYTE_SIZE: number = 4;
  static readonly UNSIGNED: boolean = false;
}
export const Int32: INumberConstructor<_Int32, number> = _Int32;


class _Int64 extends NumberBase<bigint> {
  clampValue(value: bigint): [boolean, bigint] {
    let success = true;
    if (value < _Int64.MIN_VALUE) {
      value = _Int64.MIN_VALUE;
      success = false;
    } else if (value > _Int64.MAX_VALUE) {
      value = _Int64.MAX_VALUE;
     success = false;
    }
    return [success, value];
  }
  parseInt(value: string, radix: AllowRadix): bigint {
    if (radix == 16) {
      return BigInt("0x" + value);
    } else if (radix == 10) {
      return BigInt(value);
    } else {
      const d = new Decimal((radix == 8 ? "0o": "0b") + value);
      return BigInt(d.toString());
    } 
  }

  static readonly MIN_VALUE: bigint = -(2n ** 63n);
  static readonly MAX_VALUE: bigint = 2n ** 63n - 1n;
  static readonly BYTE_SIZE: number = 8;
  static readonly UNSIGNED: boolean = false;
}
export const Int64: INumberConstructor<_Int64, bigint> = _Int64;