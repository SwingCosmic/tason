import { TASONSerializerOptions } from "@/TASONSerializerOptions";
import { Constructor } from "type-fest";



export interface TASONScalarTypeInfo<T> {
  kind: "scalar";
  ctor: Constructor<T>;
  /**
   * 同一 ctor 对应多个 TypeName 时（如 `bson.Binary` 的不同 subtype），
   * 再过滤一次。缺省只看 `instanceof ctor`。
   */
  match?: (value: T) => boolean;
  serialize?: (value: T, options: TASONSerializerOptions) => string;
  deserialize?: (value: string, options: TASONSerializerOptions) => T;
}
export interface TASONObjectTypeInfo<T> {
  kind: "object";
  ctor: T extends {} ? Constructor<T> : never;
  match?: (value: T) => boolean;
  serialize?: (value: T, options: TASONSerializerOptions) => Partial<T> & Record<string, any>;
  deserialize?: (value: Readonly<Partial<T> & Record<string, any>>, options: TASONSerializerOptions) => T;
}

export type TASONTypeInfo<T> = TASONScalarTypeInfo<T> | TASONObjectTypeInfo<T>;

export type TASONNamedTypeInfo<T> = TASONTypeInfo<T> & { name: string };
export function defineType<T>(type: TASONTypeInfo<T>): TASONTypeInfo<T> {
  return type;
}
