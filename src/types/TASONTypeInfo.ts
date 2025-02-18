import { Constructor } from "type-fest";



export interface TASONScalarTypeInfo<T> {
  kind: "scalar";
  ctor: Constructor<T>;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}
export interface TASONObjectTypeInfo<T> {
  kind: "object";
  ctor: T extends {} ? Constructor<T> : never;
  serialize?: (value: T) => Partial<T> & Record<string, any>;
  deserialize?: (value: Readonly<Partial<T> & Record<string, any>>) => T;
}

export type TASONTypeInfo<T> = TASONScalarTypeInfo<T> | TASONObjectTypeInfo<T>;
export function defineType<T>(type: TASONTypeInfo<T>): TASONTypeInfo<T> {
  return type;
}
