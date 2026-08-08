import type { RuntimeType } from "./RuntimeType";

/**
 * 将外部 schema 库解释为 RuntimeType 形状。
 * 默认不注册任何实现；官方提供 createValibotAdapter() 一键挂载。
 *
 * 职责边界：
 * - Schema / adapter → **尽可能准确的 JS RuntimeType**（含 `instance(RegExp)` → ctor）
 * - **TypeName / TypeInstance** ← Registry（交叉映射），adapter 不发明 TypeName 标签
 */
export interface RuntimeSchemaAdapter<S = unknown> {
  isSchema(value: unknown): value is S;
  /** 对象字段；非 object schema 返回 null */
  objectEntries(schema: S): Iterable<[string, S]> | null;
  /** 数组元素 schema；非 array 返回 null */
  arrayElement(schema: S): S | null;
  /**
   * 叶子或结构的 RuntimeType（与 TypeName 交叉，非粗细关系）。
   * class 实例类字段为 `"instance"`，再经 {@link instanceCtor} 取构造函数。
   */
  runtimeType(schema: S): RuntimeType;
  /**
   * 当 {@link runtimeType} 为 `"instance"` 时返回期望的 JS 构造函数；
   * 否则返回 null。
   * 例：Valibot `instance(RegExp)` → `RegExp`；`date()` → `Date`。
   */
  instanceCtor(schema: S): (abstract new (...args: any[]) => any) | null;
}
