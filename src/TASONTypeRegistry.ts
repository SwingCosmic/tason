import { Types, unsafeTypes } from "./types";
import {
  getDeclaredTypeName,
  TASONTypeDiscriminator,
  TypeDiscriminatorKey,
} from "./types/metadata";
import { TASONNamedTypeInfo, TASONTypeInfo } from "./types/TASONTypeInfo";

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

  /** 克隆一个具有相同注册类型的TASONTypeRegistry，以进行独立的操作 */
  clone() {
    const ret = new TASONTypeRegistry();
    for (const [name, type] of this.types) {
      ret.types.set(name, type);
    }
    return ret;
  }

  /** 注册一个类型 */
  registerType<T>(name: string, typeInfo: TASONTypeInfo<T>) {
    this.types.set(name, typeInfo);
  }

  /** 注册一个类型别名，指向已有的类型 */
  registerTypeAlias(name: string, originName: string) {
    const type = this.getType(originName);
    if (!type) {
      throw new Error(`Type '${originName}' does not exist`);
    }
    this.types.set(name, type);
  }

  /** 根据名称获取类型信息 */
  getType<T>(name: string): TASONTypeInfo<T> | undefined {
    return this.types.get(name);
  }

  /** 根据初始化参数创建指定类型的实例 */
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

  /** 将指定类型的实例序列化为其初始化参数 */
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

  /** 尝试获取指定对象的类型信息和名称。如果未注册，或者不是object，则返回 undefined */
  tryGetTypeInfo(value: object): TASONNamedTypeInfo<any> | undefined {
    let name = getDeclaredTypeName(value);
    if (name) {
      const type = this.types.get(name);
      if (!type) {
        throw new Error(
          `Object declared its type "${name}" in metadata, which is not registered in the registry.`,
        );
      }
      return {
        name,
        ...type,
      };
    }

    if (typeof value === "object" && TypeDiscriminatorKey in value) {
      const name = (value as TASONTypeDiscriminator)[TypeDiscriminatorKey]?.();
      if (name) {
        const type = this.types.get(name);
        if (!type) {
          throw new Error(
            `Object returned its type "${name}" in type discriminator, which is not registered in the registry.`,
          );
        }
        return {
          name,
          ...type,
        };
      }
    }

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
