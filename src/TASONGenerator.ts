import { SerializerOptions } from "./SerializerOptions";
import TASONTypeRegistry from "./TASONTypeRegistry";
import { TASONTypeInfo } from "./types/TASONTypeInfo";

export class TASONGenerator {
  private options: Required<SerializerOptions>;
  private registry: TASONTypeRegistry;
  constructor(registry: TASONTypeRegistry, options: Required<SerializerOptions>) {
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
      return this.TypeInstanceValue(value, {
        ...this.registry.getType("BigInt")!,
        name: "BigInt",
      });
    } else if (typeof value === "symbol") {
      if (!this.options.allowUnsafeTypes) {
        throw new Error(`Cannot serialize symbol type '${String(value)}'`);
      }
      return this.TypeInstanceValue(value, {
        ...this.registry.getType("Symbol")!,
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
      return this.ArrayValue(Array.from(value as any));
    } else if (Symbol.asyncIterator in (value as any)) {
      throw new Error(`Cannot serialize async iterable type`);
    } else if (typeof value === "object") {
      return this.MaybeObjectValue(value);
    }
    throw new Error(`Unsupported value type: ${typeof value}`);
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
    const type = this.registry.tryGetTypeInfo(value);
    if (!type) {
      return this.ObjectValue(value);
    } else {
      return this.TypeInstanceValue(value, type);
    }
  }

  ObjectValue(obj: Record<string, any>) {
    if (typeof obj.toJSON === "function") {
      return this.Value(obj.toJSON())!;
    } else if (typeof obj.toTASON === "function") {
      return this.Value(obj.toTASON())!;
    }

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
        pairs.push(`${this.indent()}${keyStr}: ${valueStr}`);
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

  Key(key: string) {
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return key;
    }
    return JSON.stringify(key);
  }

  TypeInstanceValue(value: any, type: TASONTypeInfo<any> & { name: string }) {
    let argStr: string;
    if (type.kind === "scalar") {
      if (type.serialize) {
        argStr = JSON.stringify(type.serialize(value));
      } else {
        argStr = JSON.stringify(String(value));
      }
    } else {
      let arg = value;
      if (type.serialize) {
        arg = type.serialize(value);
      }
      argStr = this.ObjectValue(arg);
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
