import "reflect-metadata";

import TASONSerializer from "./TASONSerializer";
import TASONTypeRegistry from "./TASONTypeRegistry";
import { Types } from "./types";

export type {
  TASONSerializerOptions,
  TASONSerializerOptionsInit,
  SerializeNumberHandling,
  DeserializeNumberHandling,
  NullValueHandling,
} from "./TASONSerializerOptions";

export type { TASONTypeInfo, TASONNamedTypeInfo } from "./TASONTypeInfo";
export { defineType } from "./TASONTypeInfo";

export type { TasonClassMetadata } from "./metadata";
export {
  TASONType,
  setTypeName,
  getDeclaredType,
  TypeDiscriminatorKey,
} from "./metadata";

export type { RuntimeType, RuntimeSchemaAdapter, RuntimeSerializeForm } from "./schema";
export {
  createValibotAdapter,
  mapTypeInstanceToRuntime,
  mapRuntimeToTypeInstance,
} from "./schema";

export interface TASONStatic extends TASONSerializer {
  Serializer: typeof TASONSerializer;
  Types: typeof Types;
  Registry: typeof TASONTypeRegistry;
}

const TASON: TASONStatic = new TASONSerializer() as any;
TASON.Serializer = TASONSerializer;
TASON.Types = Types;
TASON.Registry = TASONTypeRegistry;

export default TASON;