/**
 * JS 运行时类型种类（与 TypeName 交叉，非粗细关系）。
 *
 * - 原语 / 结构：string 标签即可表达
 * - **`instance`**：class 实例（`instanceof Ctor`）；具体构造函数由
 *   `RuntimeSchemaAdapter.instanceCtor(schema)` 给出（如 `RegExp`、`Date`）
 * - **不**把 TypeName（`RegExp`/`Date` 字符串）塞进 RuntimeType ——
 *   TypeName ↔ 实例 的交叉映射是 Registry 的职责
 */
export type RuntimeType =
  | "bigint"
  | "number"
  | "string"
  | "boolean"
  | "decimal"
  | "object"
  | "array"
  /** JS class 实例；配合 adapter.instanceCtor */
  | "instance"
  | "unknown";
