import { TerminalNode } from "antlr4";
import { StartContext, ValueContext, NullValueContext, BooleanTrueContext, BooleanFalseContext, StringValueContext, NumberValueContext, ArrayValueContext, ObjectValueContext, TypeInstanceValueContext, ObjectContext, PairContext, KeyContext, ArrayContext, TypeInstanceContext } from "./grammar/TASONParser";
import TASONTypeRegistry from "./TASONTypeRegistry";


export class TASONVisitor {
  private registry: TASONTypeRegistry;
  constructor(registry: TASONTypeRegistry) {
    this.registry = registry;
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
    } else if (ctx instanceof BooleanTrueContext) {
      return this.BooleanTrue(ctx);
    } else if (ctx instanceof BooleanFalseContext) {
      return this.BooleanFalse(ctx);
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
    const obj: Record<string, any> = {};
    ctx.pair_list().forEach((pairCtx) => {
      const pair = this.Pair(pairCtx);
      obj[pair.key] = pair.value;
    });
    return obj;
  }

  Pair(ctx: PairContext) {
    return {
      key: this.Key(ctx.key()),
      value: this.Value(ctx.value()),
    };
  }

  Key(ctx: KeyContext) {
    return ctx.getText().replace(/^['"]|['"]$/g, "");
  }

  ArrayValue(ctx: ArrayValueContext) {
    return this.Array(ctx.array());
  }

  Array(ctx: ArrayContext) {
    return ctx.value_list().map((valueCtx) => this.Value(valueCtx));
  }

  StringValue(ctx: StringValueContext) {
    return this.getTextValue(ctx.STRING());
  }

  NumberValue(ctx: NumberValueContext) {
    return parseFloat(ctx.getText());
  }

  BooleanTrue(ctx: BooleanTrueContext) {
    return true;
  }

  BooleanFalse(ctx: BooleanFalseContext) {
    return false;
  }

  NullValue(ctx: NullValueContext) {
    return null;
  }

  TypeInstanceValue(ctx: TypeInstanceValueContext) {
    return this.TypeInstance(ctx.typeInstance());
  }

  TypeInstance(ctx: TypeInstanceContext) {
    const typeName = ctx.TYPE_NAME().getText();
    const str = () => this.getTextValue(ctx.STRING());
    const obj = () => this.Object(ctx.object());

    const typeInfo = this.registry.getType(typeName);
    if (!typeInfo) throw new Error(`Unregistered type: ${typeName}`);

    return this.registry.createInstance(
      typeInfo,
      typeInfo.kind === "object" ? obj() : str()
    );
  }

  private getTextValue(ctx: TerminalNode) {
    return ctx.getText().replace(/^['"]|['"]$/g, "");
  }
}
