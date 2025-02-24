import { Types, unsafeTypes } from "./types";
import { TASONTypeInfo } from "./types/TASONTypeInfo";

export default class TASONTypeRegistry {
  private readonly types: Map<string, TASONTypeInfo<any>> = new Map();

  constructor(allowUnsafeTypes = false) {
    for (const [name, type] of Object.entries(Types)) {
      if (unsafeTypes.includes(name) && !allowUnsafeTypes) {
        continue;
      }
      this.registerType<any>(name, type);
    }
  }

  registerType<T>(name: string, typeInfo: TASONTypeInfo<T>) {
    this.types.set(name, typeInfo);
  }
  registerTypeAlias(name: string, originName: string) {
    const type = this.getType(originName);
    if (!type) {
      throw new Error(`Type '${originName}' does not exist`);
    }
    this.types.set(name, type);
  }

  getType<T>(name: string): TASONTypeInfo<T> | undefined {
    return this.types.get(name);
  }

  createInstance<T>(type: string | TASONTypeInfo<T>, arg: string | object): T {
    if (typeof type === "string") {
      type = this.getType(type)!;
    }

    if (!type) {
      throw new Error(`Unknown type: ${type}`);
    }

    if (type.kind === "scalar") {
      if (typeof arg !== "string") {
        throw new Error(`Scalar type requires string argument`);
      }

      if (type.deserialize) {
        return type.deserialize(arg);
      }
      return new type.ctor(arg);
    } else {
      if (typeof arg !== "object" || arg === null || Array.isArray(arg)) {
        throw new Error(`Object type requires object argument`);
      }

      if (type.deserialize) {
        return type.deserialize(arg as any);
      }
      const instance = new type.ctor() as any;
      for (const key of Object.keys(arg)) {
        instance[key] = (arg as any)[key];
      }
      return instance;
    }
  }

  serializeToArg<T>(type: string | TASONTypeInfo<T>, value: T): string | object {
    if (typeof type === "string") {
      type = this.getType(type)!;
    }

    if (!type) {
      throw new Error(`Unknown type: ${type}`);
    }

    let arg: any;
    if (type.kind === "scalar") {
      if (type.serialize) {
        arg = type.serialize(value);
      } else {
        arg = String(value);
      }
    } else {
      arg = value;
      if (type.serialize) {
        arg = type.serialize(value);
      } else if (typeof (value as any).toJSON === "function") {
        arg = (value as any).toJSON();
      } else if (typeof (value as any).toTASON === "function") {
        arg = (value as any).toTASON();
      } 
    }

    return arg;
  }

  tryGetTypeInfo(value: object): TASONTypeInfo<any> & { name: string } | undefined {
    for (const entry of this.types.entries()) {
      if (value instanceof entry[1].ctor) {
        return {
          ...entry[1],
          name: entry[0],
        };
      }
    }
    return undefined;
  }
}
