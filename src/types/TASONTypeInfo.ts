import { SerializerOptions } from "@/SerializerOptions";
import { Constructor } from "type-fest";



export interface TASONScalarTypeInfo<T> {
  kind: "scalar";
  ctor: Constructor<T>;
  serialize?: (value: T, options: SerializerOptions) => string;
  deserialize?: (value: string, options: SerializerOptions) => T;
}
export interface TASONObjectTypeInfo<T> {
  kind: "object";
  ctor: T extends {} ? Constructor<T> : never;
  serialize?: (value: T, options: SerializerOptions) => Partial<T> & Record<string, any>;
  deserialize?: (value: Readonly<Partial<T> & Record<string, any>>, options: SerializerOptions) => T;
}

export type TASONTypeInfo<T> = TASONScalarTypeInfo<T> | TASONObjectTypeInfo<T>;

export type TASONNamedTypeInfo<T> = TASONTypeInfo<T> & { name: string };
export function defineType<T>(type: TASONTypeInfo<T>): TASONTypeInfo<T> {
  return type;
}
