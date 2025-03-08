import { Constructor } from "type-fest";
import { TASONTypeInfo } from "./TASONTypeInfo";

export const TASONTypeNameKey = "tason:type";
export const TASONTypeInfoKey = "tason:type-info";


export function setTypeName<T>(ctor: Constructor<T>, name: string): void {
  Reflect.defineMetadata(TASONTypeNameKey, name, ctor);
}

export function TASONType(name: string, typeInfo?: Omit<TASONTypeInfo<any>, "ctor">): ClassDecorator {
  return function (target: any) {
    setTypeName(target, name);
    if (typeInfo) {
      Reflect.defineMetadata(TASONTypeInfoKey, {
        ...typeInfo,
        ctor: target
      } as TASONTypeInfo<any>, target);
    }
    return target;
  };
}

export function getDeclaredType(value: object): [string, TASONTypeInfo<any> | undefined] | undefined {
  if (typeof value !== "object" || Array.isArray(value) || value == null) {
    return;
  }
  const name = Reflect.getMetadata(TASONTypeNameKey, value.constructor);
  if (!name) {
    return;
  }
  const typeInfo = Reflect.getMetadata(TASONTypeInfoKey, value.constructor);
  return [name, typeInfo];
}

export const TypeDiscriminatorKey: unique symbol = Symbol.for("TASON.discriminator");

/** 类型判别器，让类实例支持多态序列化 */
export interface TASONTypeDiscriminator {
  [TypeDiscriminatorKey]: () => string;
}