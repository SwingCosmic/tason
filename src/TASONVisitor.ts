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
    const obj = this.Object(ctx.object());

    return this.createTypeInstance(typeName, obj);
  }

  private createTypeInstance(typeName: string, value: any) {
    const typeInfo = this.registry.getDefaultType(typeName);
    if (!typeInfo) throw new Error(`Unregistered type: ${typeName}`);
    return this.registry.createInstance(typeInfo, value);
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
