import { TerminalNode } from "antlr4";
import {
  StartContext,
  ValueContext,
  NullValueContext,
  BooleanValueContext,
  StringValueContext,
  NumberValueContext,
  ArrayValueContext,
  ObjectValueContext,
  TypeInstanceValueContext,
  ObjectContext,
  PairContext,
  KeyContext,
  ArrayContext,
  TypeInstanceContext,
  BooleanContext,
  ScalarTypeInstanceContext,
  ObjectTypeInstanceContext,
  IdentifierContext,
  StringKeyContext,
} from "./grammar/TASONParser";
import type TASONTypeRegistry from "./TASONTypeRegistry";
import unescape from "unescape-js";
import Decimal from "decimal.js";
import { TASONSerializerOptions } from "./TASONSerializerOptions";
import { unwrapNumberInstance } from "./types/NumberHandling";
import { mapTypeInstanceToRuntime } from "./schema/mapTypeInstanceToRuntime";
import type { RuntimeSchemaAdapter } from "./schema/RuntimeSchemaAdapter";
import type { RuntimeType } from "./schema/RuntimeType";

export class TASONVisitor {
  private registry: TASONTypeRegistry;
  private options: Required<TASONSerializerOptions>;
  constructor(
    registry: TASONTypeRegistry,
    options: Required<TASONSerializerOptions>
  ) {
    this.registry = registry;
    this.options = options;
  }

  visit(ctx: StartContext): any {
    return this.Start(ctx);
  }

  Start(ctx: StartContext) {
    return this.Value(ctx.value());
  }

  Value(ctx: ValueContext): any {
    if (ctx instanceof NullValueContext) {
      return this.NullValue(ctx);
    } else if (ctx instanceof BooleanValueContext) {
      return this.BooleanValue(ctx);
    } else if (ctx instanceof StringValueContext) {
      return this.StringValue(ctx);
    } else if (ctx instanceof NumberValueContext) {
      return this.NumberValue(ctx);
    } else if (ctx instanceof ArrayValueContext) {
      return this.ArrayValue(ctx);
    } else if (ctx instanceof ObjectValueContext) {
      return this.ObjectValue(ctx);
    } else if (ctx instanceof TypeInstanceValueContext) {
      return this.TypeInstanceValue(ctx);
    } else {
      throw new Error(`Unsupported value type: ${ctx.constructor.name}`);
    }
  }

  ObjectValue(ctx: ObjectValueContext) {
    return this.Object(ctx.object());
  }

  Object(ctx: ObjectContext) {
    const obj: Record<string, any> = this.options.nullPrototypeObject
      ? Object.create(null)
      : {};
    const pairs = ctx.pair_list().map(p => this.Pair(p));
    if (!this.options.allowDuplicatedKeys) {
      const keys = pairs.map(p => p.key);
      if (keys.length !== new Set(keys).size) {
        throw new Error(
          `Duplicate keys in object`
        );
      }
    }
    pairs.forEach(pair => obj[pair.key] = pair.value);
    return obj;
  }

  /**
   * 带 schema 的 object 解析：按字段 RuntimeType 收敛叶子（2.1）。
   * 无法识别 schema 时回退普通 Object。
   */
  ObjectWithSchema(
    ctx: ObjectContext,
    schema: unknown,
    adapter: RuntimeSchemaAdapter,
  ): Record<string, any> {
    if (!adapter.isSchema(schema)) {
      return this.Object(ctx);
    }

    const entries = adapter.objectEntries(schema);
    if (!entries) {
      return this.Object(ctx);
    }

    type FieldContract = {
      kind: RuntimeType;
      ctor: (abstract new (...args: any[]) => any) | null;
    };
    const fieldContracts = new Map<string, FieldContract>();
    for (const [key, fieldSchema] of entries) {
      const kind = adapter.runtimeType(fieldSchema);
      fieldContracts.set(key, {
        kind,
        ctor: kind === "instance" ? adapter.instanceCtor(fieldSchema) : null,
      });
    }

    const obj: Record<string, any> = this.options.nullPrototypeObject
      ? Object.create(null)
      : {};
    const pairs = ctx.pair_list().map(p => this.Pair(p));
    if (!this.options.allowDuplicatedKeys) {
      const keys = pairs.map(p => p.key);
      if (keys.length !== new Set(keys).size) {
        throw new Error(`Duplicate keys in object`);
      }
    }

    const handling = this.options.deserializeNumberHandling;
    for (const pair of pairs) {
      const contract = fieldContracts.get(pair.key);
      const kind = contract?.kind;
      if (kind != null && kind !== "unknown" && kind !== "object" && kind !== "array") {
        // 字面量保真：不把 string 冒充 Date/RegExp/数字；TypeInstance 已在 Pair 中构造成实例
        obj[pair.key] = mapTypeInstanceToRuntime(kind, pair.value, handling, {
          ctor: contract?.ctor ?? undefined,
        });
      } else {
        obj[pair.key] = pair.value;
      }
    }
    return obj;
  }

  Pair(ctx: PairContext) {
    return {
      key: this.Key(ctx.key()),
      value: this.Value(ctx.value()),
    };
  }

  Key(ctx: KeyContext) {
    if (ctx instanceof IdentifierContext) {
      return this.Identifier(ctx);
    }
    return this.StringValue(ctx as StringKeyContext);
  }

  Identifier(ctx: IdentifierContext) {
    return ctx.getText();
  }

  ArrayValue(ctx: ArrayValueContext) {
    return this.Array(ctx.array());
  }

  Array(ctx: ArrayContext) {
    return ctx.value_list().map((valueCtx) => this.Value(valueCtx));
  }

  StringValue(ctx: StringValueContext | StringKeyContext) {
    return this.getTextValue(ctx.STRING());
  }

  NumberValue(ctx: NumberValueContext) {
    const n = ctx.getText();
    const d = new Decimal(n);
    return d.toNumber();
  }

  BooleanValue(ctx: BooleanValueContext) {
    return this.Boolean(ctx.boolean_());
  }

  Boolean(ctx: BooleanContext) {
    return ctx.getText() === "true" ? true : false;
  }

  NullValue(ctx: NullValueContext) {
    return null;
  }

  TypeInstanceValue(ctx: TypeInstanceValueContext) {
    return this.TypeInstance(ctx.typeInstance());
  }

  TypeInstance(ctx: TypeInstanceContext) {
    if (ctx instanceof ScalarTypeInstanceContext) {
      return this.ScalarTypeInstance(ctx);
    } else if (ctx instanceof ObjectTypeInstanceContext) {
      return this.ObjectTypeInstance(ctx);
    } else {
      throw new Error(`Unsupported type instance type: ${ctx.constructor.name}`);
    }
  }

  ScalarTypeInstance(ctx: ScalarTypeInstanceContext) {
    const typeName = ctx.IDENTIFIER().getText();
    const str = this.getTextValue(ctx.STRING());

    return this.createTypeInstance(typeName, str);
  }

  ObjectTypeInstance(ctx: ObjectTypeInstanceContext) {
    const typeName = ctx.IDENTIFIER().getText();
    const typeInfo = this.registry.getDefaultType(typeName);
    if (!typeInfo) throw new Error(`Unregistered type: ${typeName}`);

    // 2.1：record-type + adapter + metadata → 叶子按契约收值
    // native 忽略契约；all 保留包装（不走契约转换）；object-type-property 仍降级
    if (this.shouldApplySchemaContract()) {
      const metadata = this.registry.getClassMetadata(typeName);
      const adapter = this.registry.getSchemaAdapter();
      if (metadata && adapter && adapter.isSchema(metadata.schema)) {
        const bag = this.ObjectWithSchema(ctx.object(), metadata.schema, adapter);
        return this.registry.createInstance(typeInfo, bag);
      }
    }

    const obj = this.Object(ctx.object());
    return this.createTypeInstance(typeName, obj);
  }

  /** 阶段 2.1：仅 record-type 在有契约时应用叶子映射 */
  private shouldApplySchemaContract(): boolean {
    const h = this.options.deserializeNumberHandling;
    // native：全拆箱忽略契约；all：保留包装；object-type-property：2.1 仍降级
    return h === "record-type";
  }

  private createTypeInstance(typeName: string, value: any) {
    const typeInfo = this.registry.getDefaultType(typeName);
    if (!typeInfo) throw new Error(`Unregistered type: ${typeName}`);
    const instance = this.registry.createInstance(typeInfo, value);
    return unwrapNumberInstance(instance, this.options.deserializeNumberHandling);
  }

  private getTextValue(ctx: TerminalNode) {
    let str = ctx.getText();
    if (str.length < 2) {
      throw new Error(`Invalid string literal: ${str}`);
    }
    str = str.slice(1, -1);
    return unescape(str);
  }
}
