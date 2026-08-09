/**
 * Class 级元数据：用现成库 Schema 描述 RuntimeType 形状（接口协定）。
 * schema 对核心不透明，由已注册的 RuntimeSchemaAdapter 解释。
 */
export interface TasonClassMetadata<S = unknown> {
  ctor?: abstract new (...args: any[]) => any;
  /** 不透明契约；由已注册 adapter 解释 */
  schema: S;
}
