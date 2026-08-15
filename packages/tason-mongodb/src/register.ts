import type { TASONTypeRegistry } from "tason";
import type { RegisterMongoDBTypesOptions } from "./options";
import {
  ALL_MONGO_TYPE_NAMES,
  MongoTypeCatalog,
  MongoTypes,
  type MongoTypeName,
} from "./types";

function shouldReplaceDefault(
  typeName: MongoTypeName,
  opt: RegisterMongoDBTypesOptions["replaceDefaultImplementation"],
): boolean {
  if (opt === true) return true;
  if (opt == null || opt === false) return false;
  return opt[typeName as keyof typeof opt] === true;
}

/**
 * 向 registry 注册本包全部（或 `include` 指定的）类型。
 *
 * {@link MongoTypes} 未填 TypeInfo 的项会跳过，不改对应 registry 条目。
 * 实现填入 TypeInfo 后：
 * - 新 TypeName：`registerType`
 * - 追加类型实现：`registerType` push；`replaceDefaultImplementation` 时 `asDefault`
 *
 * 同一 registry 重复调用：核心按 ctor 幂等更新，不重复堆积。
 */
export function registerMongoDBTypes(
  registry: TASONTypeRegistry,
  options: RegisterMongoDBTypesOptions = {},
): TASONTypeRegistry {
  const include = options.include ?? [...ALL_MONGO_TYPE_NAMES];
  const known = new Set<string>(ALL_MONGO_TYPE_NAMES);
  for (const name of include) {
    if (!known.has(name)) {
      throw new Error(`Unknown MongoDB type '${String(name)}'`);
    }
  }
  const includeSet = new Set(include);

  for (const spec of MongoTypeCatalog) {
    if (!includeSet.has(spec.typeName)) continue;
    if (spec.unsafe && !registry.allowUnsafeTypes) {
      if (options.include?.includes(spec.typeName)) {
        throw new Error(
          `MongoDB type '${spec.typeName}' requires allowUnsafeTypes`,
        );
      }
      continue;
    }
    const typeInfo = MongoTypes[spec.typeName];
    if (!typeInfo) continue;

    const asDefault =
      spec.strategy === "append" &&
      spec.canReplaceDefault === true &&
      shouldReplaceDefault(spec.typeName, options.replaceDefaultImplementation);

    registry.registerType(spec.typeName, typeInfo, undefined, { asDefault });
  }

  return registry;
}
