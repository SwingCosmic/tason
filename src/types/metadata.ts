
export const TASONTypeNameKey = "tason:type";

export function TASONType(name: string): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(TASONTypeNameKey, name, target);
    return target;
  };
}

export function getDeclaredTypeName(value: object): string | undefined {
  if (typeof value !== "object" || Array.isArray(value) || value == null) {
    return;
  }
  return Reflect.getMetadata(TASONTypeNameKey, value.constructor);
}