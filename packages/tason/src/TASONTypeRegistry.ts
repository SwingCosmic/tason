import { TASONSerializerOptions } from "./TASONSerializerOptions";
import { Types, unsafeTypes, typeAlias } from "./types";
import {
  getDeclaredType,
  TASONTypeDiscriminator,
  TypeDiscriminatorKey,
  type TasonClassMetadata,
} from "./metadata";
import { TASONNamedTypeInfo, TASONTypeInfo } from "./TASONTypeInfo";
import type { RuntimeSchemaAdapter } from "./schema/RuntimeSchemaAdapter";

interface TASONRegistryEntry<T> {
  name: string;
  types: TASONTypeInfo<T>[];
  /** R1：与 register 同生命周期的 ClassMetadata 旁路 */
  metadata?: TasonClassMetadata;
}

export default class TASONTypeRegistry {
  private readonly types: Map<string, TASONRegistryEntry<any>> = new Map();

  /** 默认无 adapter；需显式 setSchemaAdapter(createValibotAdapter()) */
  private schemaAdapter: RuntimeSchemaAdapter | undefined;

  private readonly options: TASONSerializerOptions;
  constructor(options: TASONSerializerOptions) {
    this.options = options;
    for (const [name, type] of Object.entries(Types)) {
      if (unsafeTypes.includes(name) && !options.allowUnsafeTypes) {
        continue;
      }
      this.registerType<any>(name, type);
    }
    for (const [name, type] of Object.entries(typeAlias)) {
      this.registerTypeAlias(name, type);
    }
  }

  /** 克隆一个具有相同注册类型与 adapter 的 TASONTypeRegistry */
  clone() {
    const ret = new TASONTypeRegistry(this.options);
    for (const [name, type] of this.types) {
      ret.types.set(name, {
        name: type.name,
        types: [...type.types],
        metadata: type.metadata,
      });
    }
    ret.schemaAdapter = this.schemaAdapter;
    return ret;
  }

  /**
   * 注册或清除 RuntimeSchemaAdapter。
   * 传入 null 清除；默认无实现。
   */
  setSchemaAdapter(adapter: RuntimeSchemaAdapter | null): void {
    this.schemaAdapter = adapter ?? undefined;
  }

  getSchemaAdapter(): RuntimeSchemaAdapter | undefined {
    return this.schemaAdapter;
  }

  /**
   * 注册一个类型。
   * @param metadata 可选 ClassMetadata（含 schema 契约）；R1 存于 entry 旁路
   */
  registerType<T>(
    name: string,
    typeInfo: TASONTypeInfo<T>,
    metadata?: TasonClassMetadata,
  ) {
    let entry = this.getEntry(name);
    entry.types.push(typeInfo);
    if (metadata !== undefined) {
      entry.metadata = metadata;
    }
  }

  /** 读取类型的 ClassMetadata（整包）；无则 undefined。不提供 getSchema。 */
  getClassMetadata(name: string): TasonClassMetadata | undefined {
    return this.types.get(name)?.metadata;
  }

  /**
   * 按 JS 构造函数查找已注册 TypeName（第一个匹配的 entry）。
   * Schema 侧只表达 RuntimeType/ctor；转 TypeName 是 Registry 的职责。
   */
  findTypeNameByCtor(
    ctor: abstract new (...args: any[]) => any,
  ): string | undefined {
    for (const [name, entry] of this.types) {
      for (const type of entry.types) {
        if (type.ctor === ctor) {
          return name;
        }
      }
    }
    return undefined;
  }

  /**
   * 按构造函数 + **TypeInstance 标量参数**构造实例（ctor → TypeName → createInstance）。
   * 仅用于已带类型语义的标量参数（来自 `Date("…")` 等 TypeInstance 的内部 arg），
   * **不是**把 JSON 字符串字面量偷换成 Date/RegExp（字面量保真见 mapTypeInstanceToRuntime）。
   */
  createInstanceByCtor<T = unknown>(
    ctor: abstract new (...args: any[]) => any,
    scalarArg: string,
  ): T {
    const name = this.findTypeNameByCtor(ctor);
    if (!name) {
      throw new Error(
        `No registered TypeName for constructor ${ctor.name || "(anonymous)"}`,
      );
    }
    return this.createInstance<T>(name, scalarArg);
  }

  /** 注册一个类型别名，指向已有的类型 */
  registerTypeAlias(name: string, originName: string) {
    // entry是同一个实例，因此原类型增加了实现，别名也会同步
    const entry = this.types.get(originName);
    if (!entry) {
      throw new Error(`Type '${originName}' does not exist`);
    }
    this.types.set(name, entry);
  }

  
  getType<T>(name: string, obj: T): TASONTypeInfo<T> | undefined {
    const entry = this.types.get(name);
    if (!entry) return;

    return entry.types.find(t => obj instanceof t.ctor) as TASONTypeInfo<T>;
  }
  getDefaultType<T>(name: string): TASONTypeInfo<T> | undefined {
    const entry = this.types.get(name);
    if (!entry) return;

    return entry.types[0];
  }

  /** 根据名称获取类型信息 */
  getAllTypes<T>(name: string): TASONTypeInfo<T>[] {
    const entry = this.types.get(name);
    if (!entry) return [];

    return entry.types;
  }

  private getEntry<T>(name: string): TASONRegistryEntry<T> {
    let entry = this.types.get(name);
    if (!entry) {
      entry = {
        name,
        types: [],
      };
      this.types.set(name, entry);
    }
    return entry;
  }

  /** 根据初始化参数创建指定类型的实例 */
  createInstance<T>(type: string | TASONTypeInfo<T>, arg: string | object): T {
    if (typeof type === "string") {
      type = this.getDefaultType(type)!;
    }

    if (!type) {
      throw new Error(`Unknown type: ${type}`);
    }

    if (type.kind === "scalar") {
      if (typeof arg !== "string") {
        throw new Error(`Scalar type requires string argument`);
      }

      if (type.deserialize) {
        return type.deserialize(arg, this.options);
      }
      return new type.ctor(arg);
    } else {
      if (typeof arg !== "object" || arg === null || Array.isArray(arg)) {
        throw new Error(`Object type requires object argument`);
      }

      if (type.deserialize) {
        return type.deserialize(arg as any, this.options);
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
      type = this.getType(type, value)!;
    }

    if (!type) {
      throw new Error(`Unknown type: ${type}`);
    }

    let arg: any;
    if (type.kind === "scalar") {
      if (type.serialize) {
        arg = type.serialize(value, this.options);
      } else {
        arg = String(value);
      }
    } else {
      arg = value;
      if (type.serialize) {
        arg = type.serialize(value, this.options);
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
    let typemeta = getDeclaredType(value);
    if (typemeta) {
      let [name, type] = typemeta;
      if (!type) {
        type = this.getType(name, value);
      }
      if (type) {
        return {
          name,
          ...type,
        };        
      }

      throw new Error(
        `Object declared its type "${name}" in metadata, which is not registered in the registry.`,
      );
    }

    if (typeof value === "object" && TypeDiscriminatorKey in value) {
      const name = (value as TASONTypeDiscriminator)[TypeDiscriminatorKey]();
      if (name) {
        const type = this.getType(name, value);
        if (!type) {
          throw new Error(
            `Object returned its type "${name}" in type discriminator, which is not registered in the registry.`,
          );
        }
        return {
          name,
          ...type,
        };
      } else {
        console.warn(`Object did not return a type name in type discriminator.`);
      }
    }

    for (const entry of this.types.entries()) {
      for (const type of entry[1].types) {
        if (value instanceof type.ctor) {
          return {
            ...type,
            name: entry[0],
          };
        }        
      }
    }
    return undefined;
  }
}
