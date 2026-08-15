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
import type { TASONTypeInfo } from "./TASONTypeInfo";
import unescape from "unescape-js";
import Decimal from "decimal.js";
import { TASONSerializerOptions } from "./TASONSerializerOptions";
import { unwrapNumberInstance } from "./types/NumberHandling";
import { mapTypeInstanceToRuntime } from "./schema/mapTypeInstanceToRuntime";
import type { RuntimeSchemaAdapter } from "./schema/RuntimeSchemaAdapter";
import type { RuntimeType } from "./schema/RuntimeType";

type ParseExpected =
  | (abstract new (...args: any[]) => any)
  | string;

/**
 * 反序列化 Visitor。
 * 有 schema 时的结构 walk 对齐 C# `TasonVisitor_Typed`：
 * - `FillObjectMembers` → {@link ObjectWithSchema} / {@link mapObjectBagWithSchema}
 * - `TypedArray` / `TypedValueContext` 元素期望类型 → {@link mapValueWithSchema}
 */
export class TASONVisitor {
  private registry: TASONTypeRegistry;
  private options: Required<TASONSerializerOptions>;
  /**
   * ObjectTypeInstance 嵌套深度。
   * >0 且 handling 为 object-fallback-all、无字段契约时，保留数值包装。
   */
  private objectTypeDepth = 0;
  /**
   * parseAs 传入的期望类型；仅消费根 TypeInstance，嵌套仍走 getDefaultType。
   */
  private expected: ParseExpected | undefined;

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

  /**
   * 指定类型反序列化入口。根 TypeInstance 用 expected 选型；无匹配抛错。
   */
  visitAs(ctx: StartContext, expected: ParseExpected): any {
    this.expected = expected;
    try {
      const value = this.Start(ctx);
      if (this.expected !== undefined) {
        const label =
          typeof expected === "string"
            ? expected
            : expected.name || "(anonymous)";
        throw new Error(
          `parseAs expected a TypeInstance compatible with ${label}`,
        );
      }
      return value;
    } finally {
      this.expected = undefined;
    }
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
   * 带 schema 的 object 解析：先无类型解析 bag，再按字段契约递归映射
   *（C# `FillObjectMembers` + `TypedValueContext`）。
   */
  ObjectWithSchema(
    ctx: ObjectContext,
    schema: unknown,
    adapter: RuntimeSchemaAdapter,
  ): Record<string, any> {
    if (!adapter.isSchema(schema)) {
      return this.Object(ctx);
    }
    const bag = this.Object(ctx);
    return this.mapObjectBagWithSchema(bag, schema, adapter);
  }

  /**
   * 对已解析的 plain object bag 按 schema entries 递归收值。
   */
  private mapObjectBagWithSchema(
    bag: Record<string, any>,
    schema: unknown,
    adapter: RuntimeSchemaAdapter,
  ): Record<string, any> {
    const entries = adapter.objectEntries(schema);
    if (!entries) {
      return bag;
    }

    type FieldContract = {
      schema: unknown;
      kind: RuntimeType;
      ctor: (abstract new (...args: any[]) => any) | null;
    };
    const fieldContracts = new Map<string, FieldContract>();
    for (const [key, fieldSchema] of entries) {
      const kind = adapter.runtimeType(fieldSchema);
      fieldContracts.set(key, {
        schema: fieldSchema,
        kind,
        ctor: kind === "instance" ? adapter.instanceCtor(fieldSchema) : null,
      });
    }

    const obj: Record<string, any> = this.options.nullPrototypeObject
      ? Object.create(null)
      : {};

    for (const [key, value] of Object.entries(bag)) {
      const contract = fieldContracts.get(key);
      if (!contract) {
        obj[key] = value;
        continue;
      }
      obj[key] = this.mapValueWithSchema(
        value,
        contract.schema,
        adapter,
        contract,
      );
    }
    return obj;
  }

  /**
   * 单值按 schema 递归映射（C# `TypedValueContext`）。
   * array → 元素 schema 只内省一次，大数组热路径只做数值转换；
   * 嵌套 plain object → entries；叶子 → mapTypeInstanceToRuntime。
   */
  private mapValueWithSchema(
    value: unknown,
    schema: unknown,
    adapter: RuntimeSchemaAdapter,
    precomputed?: {
      kind: RuntimeType;
      ctor: (abstract new (...args: any[]) => any) | null;
    },
  ): unknown {
    const kind = precomputed?.kind ?? adapter.runtimeType(schema);
    const ctor =
      precomputed?.ctor ??
      (kind === "instance" ? adapter.instanceCtor(schema) : null);
    const handling = this.options.deserializeNumberHandling;

    if (kind === "array") {
      if (!Array.isArray(value)) {
        return value;
      }
      const elementSchema = adapter.arrayElement(schema);
      if (elementSchema == null) {
        return value;
      }
      // 元素契约只解析一次，避免 Int32[] 等大数组上 O(n) 次 runtimeType/unwrap
      const elemKind = adapter.runtimeType(elementSchema);
      const elemCtor =
        elemKind === "instance" ? adapter.instanceCtor(elementSchema) : null;

      if (this.isLeafRuntimeType(elemKind)) {
        // 热路径：同质叶子数组，循环内只做 RuntimeType 收敛
        return value.map((el) =>
          mapTypeInstanceToRuntime(elemKind, el, handling, {
            ctor: elemCtor ?? undefined,
          }),
        );
      }

      const elemContract = { kind: elemKind, ctor: elemCtor };
      return value.map((el) =>
        this.mapValueWithSchema(el, elementSchema, adapter, elemContract),
      );
    }

    if (kind === "object") {
      // 已是注册类实例（嵌套 ObjectTypeInstance 已在 TypeInstance 路径处理）→ 透传
      if (
        value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !this.isPlainObject(value)
      ) {
        return value;
      }
      if (
        value == null ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        return value;
      }
      return this.mapObjectBagWithSchema(
        value as Record<string, any>,
        schema,
        adapter,
      );
    }

    if (kind === "unknown") {
      return value;
    }

    return mapTypeInstanceToRuntime(kind, value, handling, {
      ctor: ctor ?? undefined,
    });
  }

  /** 可直接 mapTypeInstanceToRuntime 的叶子 kind（非结构） */
  private isLeafRuntimeType(kind: RuntimeType): boolean {
    return (
      kind === "bigint" ||
      kind === "number" ||
      kind === "decimal" ||
      kind === "string" ||
      kind === "boolean" ||
      kind === "instance"
    );
  }

  /** null-prototype 或 Object.prototype 的 bag 视为 plain object */
  private isPlainObject(value: object): boolean {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
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
    const typeInfo = this.resolveTypeInfo(typeName);
    return this.finishInstance(typeInfo, str);
  }

  ObjectTypeInstance(ctx: ObjectTypeInstanceContext) {
    const typeName = ctx.IDENTIFIER().getText();
    const typeInfo = this.resolveTypeInfo(typeName);

    // 进入 ObjectType 成员上下文（C# ObjectType 属性路径）
    // 仅影响「无字段契约」时 OTP 是否保留数值包装；有 schema 叶子契约时由 map* 收到 RuntimeType
    this.objectTypeDepth++;
    try {
      // 有 schema 时：ClassMetadata 优先于 OTP 的「≈ all」
      // （OTP 的保留包装只覆盖无契约字段；有契约必须落到 bigint/number/… 才能给应用用）
      // native / all：明确忽略契约
      // parseAs：先按期望 ctor 选 TypeInfo，再套该 TypeName 的 schema
      if (this.shouldApplySchemaContract()) {
        const metadata = this.registry.getClassMetadata(typeName);
        const adapter = this.registry.getSchemaAdapter();
        if (metadata && adapter && adapter.isSchema(metadata.schema)) {
          const bag = this.ObjectWithSchema(
            ctx.object(),
            metadata.schema,
            adapter,
          );
          return this.finishInstance(typeInfo, bag);
        }
      }

      const obj = this.Object(ctx.object());
      return this.finishInstance(typeInfo, obj);
    } finally {
      this.objectTypeDepth--;
    }
  }

  /**
   * 解析 TypeInstance 所用 TypeInfo。
   * 自动 parse：getDefaultType。
   * parseAs：仅根节点消费 expected（ctor → getTypeInfoByCtor；TypeName → 默认实现，须同 entry / 别名）。
   */
  private resolveTypeInfo(typeName: string) {
    const expected = this.expected;
    if (expected === undefined) {
      const typeInfo = this.registry.getDefaultType(typeName);
      if (!typeInfo) throw new Error(`Unregistered type: ${typeName}`);
      return typeInfo;
    }

    this.expected = undefined;

    if (typeof expected === "string") {
      if (!this.registry.isSameTypeName(typeName, expected)) {
        throw new Error(
          `Expected TypeName "${expected}", got "${typeName}"`,
        );
      }
      const typeInfo = this.registry.getDefaultType(expected);
      if (!typeInfo) throw new Error(`Unregistered type: ${expected}`);
      return typeInfo;
    }

    const typeInfo = this.registry.getTypeInfoByCtor(typeName, expected);
    if (!typeInfo) {
      throw new Error(
        `No implementation of "${typeName}" for constructor ${expected.name || "(anonymous)"}`,
      );
    }
    return typeInfo;
  }

  private finishInstance(typeInfo: TASONTypeInfo<any>, value: any) {
    const instance = this.registry.createInstance(typeInfo, value);
    return unwrapNumberInstance(
      instance,
      this.options.deserializeNumberHandling,
      { inObjectType: this.objectTypeDepth > 0 },
    );
  }

  /**
   * 是否走 schema 契约收值。
   * - object-fallback-native / object-fallback-all：有契约 → RuntimeType
   * - native / all：不走契约
   */
  private shouldApplySchemaContract(): boolean {
    const h = this.options.deserializeNumberHandling;
    return h === "object-fallback-native" || h === "object-fallback-all";
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
