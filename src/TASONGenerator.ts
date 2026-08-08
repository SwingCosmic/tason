import { TASONSerializerOptions } from "./TASONSerializerOptions";
import type TASONTypeRegistry from "./TASONTypeRegistry";
import { Buffer } from "./types/Buffer";
import { DictionaryTypeInfo } from "./types/Dictionary";
import { TASONTypeInfo } from "./TASONTypeInfo";
import typeDetect from "type-detect";
import {
  isNumberTypeName,
  resolveSerializeNumberHandling,
  trySerializeNumberAsLiteral,
  trySerializeNumberAsSafeNumberLiteral,
} from "./types/NumberHandling";
import { mapRuntimeToTypeInstance } from "./schema/mapRuntimeToTypeInstance";
import type { RuntimeSchemaAdapter } from "./schema/RuntimeSchemaAdapter";
import type { RuntimeType } from "./schema/RuntimeType";

export class TASONGenerator {
  private options: Required<TASONSerializerOptions>;
  private registry: TASONTypeRegistry;
  constructor(registry: TASONTypeRegistry, options: Required<TASONSerializerOptions>) {
    this.registry = registry;
    this.options = options;
  }

  private indentLevel = 0;

  public generate(value: unknown): string {
    return this.Value(value)!;
  }

  Value(value: unknown, scope: "root" | "object-value" = "root"): string | undefined {
    if (value === null || value === undefined) {
      return this.NullValue();
    } else if (typeof value === "boolean") {
      return this.BooleanValue(value);
    } else if (typeof value === "string") {
      return this.StringValue(value);
    } else if (typeof value === "number") {
      return this.NumberValue(value);
    } else if (typeof value === "bigint") {
      return this.BigIntValue(value);
    } else if (typeof value === "symbol") {
      if (!this.options.allowUnsafeTypes) {
        throw new Error(`Cannot serialize symbol type '${String(value)}'`);
      }
      return this.TypeInstanceValue(value, {
        ...this.registry.getDefaultType("Symbol")!,
        name: "Symbol",
      });
    } else if (typeof value === "function") {
      if (scope !== "object-value") {
        throw new Error(`Cannot serialize function type '${value.name}'`);
      }
      return undefined;
    } else if (Array.isArray(value)) {
      return this.ArrayValue(value);
    } else if (Symbol.iterator in (value as any)) {
      // 可迭代协议：仅当 [Symbol.iterator] 真是方法时才按 iterable 序列化
      const iter = (value as any)[Symbol.iterator];
      if (typeof iter !== "function") {
        throw new Error(
          `[Symbol.iterator] is present but is not a method (got ${typeof iter}). ` +
            `Protocol symbols must be functions when used for iteration.`,
        );
      }
      return this.MaybeArrayValue(value as any);
    } else if (Symbol.asyncIterator in (value as any)) {
      const aiter = (value as any)[Symbol.asyncIterator];
      if (typeof aiter !== "function") {
        throw new Error(
          `[Symbol.asyncIterator] is present but is not a method (got ${typeof aiter}). ` +
            `Protocol symbols must be functions when used for iteration.`,
        );
      }
      throw new Error(`Cannot serialize async iterable type`);
    } else {
      return this.MaybeObjectValue(value as object);
    }
  }

  NullValue() {
    return "null";
  }

  BooleanValue(value: boolean) {
    return value === true ? "true" : "false";
  }

  StringValue(value: string) {
    return JSON.stringify(value);
  }

  NumberValue(value: number) {
    return value.toString(10);
  }

  BigIntValue(value: bigint) {
    const effective = resolveSerializeNumberHandling(
      this.options.serializeNumberHandling,
    );
    if (effective === "none") {
      // 强制字面量，含超大整数
      return trySerializeNumberAsLiteral(value)!;
    }
    if (effective === "unsafe-only") {
      const literal = trySerializeNumberAsSafeNumberLiteral(value);
      if (literal != null) {
        return literal;
      }
    }
    // all，或 unsafe-only 下超出安全范围
    return this.TypeInstanceValue(value, {
      ...this.registry.getDefaultType("BigInt")!,
      name: "BigInt",
    });
  }

  MaybeArrayValue(value: Iterable<any>) {
    if (value instanceof Map) {
      if (this.options.useBuiltinDictionary) {
        return this.TypeInstanceValue(value, {
          ...this.registry.getDefaultType("Dictionary")!,
          name: "Dictionary",
        });
      } else {
        // Map → 普通对象：仅字符串键。
        // 无 allowUnsafeTypes 时，symbol 键/值已进入序列化逻辑 → 必须报错（不可静默丢弃）。
        // 有 allowUnsafeTypes 时，symbol 键仍无法写入对象语法，跳过；symbol 值可保留。
        const entries: [string, unknown][] = [];
        for (const [k, v] of value.entries()) {
          if (typeof k === "function" || typeof v === "function") {
            continue;
          }
          if (typeof k === "symbol" || typeof v === "symbol") {
            if (!this.options.allowUnsafeTypes) {
              throw new Error(
                `Cannot serialize symbol as Map key or value when allowUnsafeTypes is false`,
              );
            }
            if (typeof k === "symbol") {
              continue; // 对象字面量无法表达 Symbol 键
            }
          }
          if (typeof k !== "string") {
            continue;
          }
          entries.push([k, v]);
        }
        return this.ObjectValue(Object.fromEntries(entries));
      }
    }
    if (value instanceof Set) {
      return this.ArrayValue(Array.from(value));
    }
    return this.ArrayValue(Array.from(value));
  }

  ArrayValue(value: unknown[]) {
    if (value.length === 0) {
      return "[]";
    }

    let arr: string[] = [];
    this.indentLevel++;
    {
      this.checkDepth();
      arr = value.map(v => this.indent() + this.Value(v));
    }
    this.indentLevel--;

    if (this.options.indent === false) {
      return `[${arr.join(",")}]`;
    } else {
      return `[\n${arr.join(",\n")}\n${this.indent()}]`;
    }
  }

  MaybeObjectValue(value: object) {
    // 处理弱引用
    if (value instanceof WeakMap || value instanceof WeakSet || (typeof WeakRef === "function" && value instanceof WeakRef)) {
      const name = typeDetect(value);
      throw new Error(`Cannot serialize garbage-collectable type ${name}`);
    }

    // 处理TypedArray, DataView和ArrayBufferLike
    do {
      let buffer: ArrayBufferLike | null = null;
      if (ArrayBuffer.isView(value)) {
        buffer = value.buffer;
      } else if (value instanceof ArrayBuffer) {
        buffer = value;
      } else {
        break;
      }

      if (buffer instanceof SharedArrayBuffer && !this.options.allowUnsafeTypes) {
        throw new Error(`SharedArrayBuffer can be modified by multiple threads which may cause unexpected behavior.`);
      }
      value = new Buffer(buffer);
    } while (false);

    const type = this.registry.tryGetTypeInfo(value);
    if (!type) {
      return this.ObjectValue(value);
    }

    // 数值包装：none 强制字面量；unsafe-only 尽量 number；all 始终 TypeName
    if (isNumberTypeName(type.name)) {
      const effective = resolveSerializeNumberHandling(
        this.options.serializeNumberHandling,
      );
      if (effective === "none") {
        const literal = trySerializeNumberAsLiteral(value);
        if (literal != null) {
          return literal;
        }
        // 内置数值包装应总能字面量化；兜底仍避免静默装箱
        throw new Error(
          `serializeNumberHandling "none" cannot emit a bare literal for type ${type.name}`,
        );
      }
      if (effective === "unsafe-only") {
        const literal = trySerializeNumberAsSafeNumberLiteral(value);
        if (literal != null) {
          return literal;
        }
      }
    }

    return this.TypeInstanceValue(value, type);
  }

  ObjectValue(obj: Record<string, any>) {
    if (typeof obj.toJSON === "function") {
      return this.Value(obj.toJSON())!;
    } else if (typeof obj.toTASON === "function") {
      return this.Value(obj.toTASON())!;
    }

    // 可枚举 Symbol 键（协议 iterable 已在 Value 分支处理，一般不会落到此处）
    const symbolKeys = Object.getOwnPropertySymbols(obj).filter((s) =>
      Object.prototype.propertyIsEnumerable.call(obj, s),
    );

    // allowUnsafeTypes + 存在 Symbol 键：尝试把含 symbol 的键值对读进来
    // - useBuiltinDictionary → 提升为 Dictionary 完整表达
    // - 否则对象语法无法表达 Symbol 键 → 忽略（仅字符串键）
    if (
      this.options.allowUnsafeTypes &&
      this.options.useBuiltinDictionary &&
      symbolKeys.length > 0
    ) {
      const map = new Map<any, any>();
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "function") continue;
        if (this.options.nullPropertyHandling === "ignore" && v == null) continue;
        map.set(k, v);
      }
      for (const sk of symbolKeys) {
        const v = obj[sk as any];
        if (typeof v === "function") continue;
        if (this.options.nullPropertyHandling === "ignore" && v == null) continue;
        map.set(sk, v);
      }
      return this.TypeInstanceValue(map, {
        ...this.registry.getDefaultType("Dictionary")!,
        name: "Dictionary",
      });
    }

    // 默认 / 无 Dictionary：仅字符串可枚举键（Object.entries）；Symbol 键忽略
    const pairs: string[] = [];
    this.indentLevel++;
    {
      this.checkDepth();
      for (const [key, value] of Object.entries(obj)) {
        const keyStr = this.Key(key);
        const valueStr = this.Value(value, "object-value");
        if (valueStr === undefined) {
          continue;
        }

        if (this.options.nullPropertyHandling === "ignore" && value == null) {
          continue;
        }
        const space = this.options.indent === false ? "" : " ";
        pairs.push(`${this.indent()}${keyStr}:${space}${valueStr}`);
      }
    }
    this.indentLevel--;

    if (pairs.length === 0) {
      return "{}";
    }

    if (this.options.indent === false) {
      return `\{${pairs.join(",")}\}`;
    } else {
      return `\{\n${pairs.join(",\n")}\n${this.indent()}\}`;
    }
  }

  /**
   * 带 schema 的 object 写出：叶子按 RuntimeType + serialize Handling 映射（2.1）。
   */
  ObjectValueWithSchema(
    obj: Record<string, any>,
    schema: unknown,
    adapter: RuntimeSchemaAdapter,
  ): string {
    if (!adapter.isSchema(schema)) {
      return this.ObjectValue(obj);
    }
    const entries = adapter.objectEntries(schema);
    if (!entries) {
      return this.ObjectValue(obj);
    }

    const fieldKinds = new Map<string, RuntimeType>();
    for (const [key, fieldSchema] of entries) {
      fieldKinds.set(key, adapter.runtimeType(fieldSchema));
    }

    // 以实例字段为准；schema 提供期望 kind
    const pairs: string[] = [];
    this.indentLevel++;
    {
      this.checkDepth();
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "function") {
          continue;
        }
        if (this.options.nullPropertyHandling === "ignore" && value == null) {
          continue;
        }

        const keyStr = this.Key(key);
        const kind = fieldKinds.get(key);
        let valueStr: string | undefined;

        if (
          kind != null &&
          kind !== "unknown" &&
          kind !== "object" &&
          kind !== "array"
        ) {
          valueStr = this.emitMappedField(kind, value);
        } else {
          valueStr = this.Value(value, "object-value");
        }

        if (valueStr === undefined) {
          continue;
        }
        const space = this.options.indent === false ? "" : " ";
        pairs.push(`${this.indent()}${keyStr}:${space}${valueStr}`);
      }
    }
    this.indentLevel--;

    if (pairs.length === 0) {
      return "{}";
    }

    if (this.options.indent === false) {
      return `\{${pairs.join(",")}\}`;
    } else {
      return `\{\n${pairs.join(",\n")}\n${this.indent()}\}`;
    }
  }

  private emitMappedField(kind: RuntimeType, value: unknown): string {
    const mapped = mapRuntimeToTypeInstance(
      kind,
      value,
      this.options.serializeNumberHandling,
    );
    if (mapped.form === "literal") {
      return mapped.text;
    }
    if (mapped.form === "type-instance") {
      return `${mapped.typeName}(${this.StringValue(mapped.scalarArg)})`;
    }
    return this.Value(mapped.value, "object-value")!;
  }

  Key(key: string) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return key;
    }
    return JSON.stringify(key);
  }

  TypeInstanceValue(value: any, type: TASONTypeInfo<any> & { name: string }) {
    let argStr: string;
    let arg = this.registry.serializeToArg(type, value);
    if (type.kind === "scalar") {
      argStr = this.StringValue(arg as string);
    } else {
      // 2.1：ObjectType + metadata + adapter → 叶子按契约写出
      const metadata = this.registry.getClassMetadata(type.name);
      const adapter = this.registry.getSchemaAdapter();
      if (
        metadata &&
        adapter &&
        adapter.isSchema(metadata.schema) &&
        typeof arg === "object" &&
        arg !== null
      ) {
        argStr = this.ObjectValueWithSchema(
          arg as Record<string, any>,
          metadata.schema,
          adapter,
        );
      } else {
        argStr = this.ObjectValue(arg as object);
      }
    }
    return `${type.name}(${argStr})`;
  }

  private checkDepth() {
    if (this.indentLevel > this.options.maxDepth) {
      throw new Error(
        "Maximum object or array depth exceeded. Is there a circular reference?",
      );
    }
  }
  private indent() {
    return this.options.indent === false
      ? ""
      : " ".repeat(this.indentLevel * this.options.indent);
  }
}
