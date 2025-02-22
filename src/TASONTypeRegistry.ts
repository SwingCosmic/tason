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

  getType<T>(name: string): TASONTypeInfo<T> | undefined {
    return this.types.get(name);
  }

  createInstance<T>(type: string | TASONTypeInfo<T>, value: string | object): T {
    if (typeof type === "string") {
      type = this.getType(type)!;
    }

    if (!type) {
      throw new Error(`Unknown type: ${type}`);
    }

    if (type.kind === "scalar") {
      if (typeof value !== "string") {
        throw new Error(`Scalar type requires string argument`);
      }

      if (type.deserialize) {
        return type.deserialize(value);
      }
      return new type.ctor(value);
    } else {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Object type requires object argument`);
      }

      if (type.deserialize) {
        return type.deserialize(value as any);
      }
      const instance = new type.ctor() as any;
      for (const key of Object.keys(value)) {
        instance[key] = (value as any)[key];
      }
      return instance;
    }
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
