import type { TASONTypeRegistry } from "tason";
import { bindBson, loadDefaultBson } from "./bson-ns";
import type { RegisterMongoDBTypesOptions } from "./options";
import {
  ALL_MONGO_TYPE_NAMES,
  MongoTypeCatalog,
  MongoTypes,
  mongoTypeInfoList,
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
 * - **先**把 `options.bson`（缺省 {@link loadDefaultBson}）写入模块持有点（静态 {@link MongoTypes} 的 ctor 随之变化）
 * - 新 TypeName：`registerType`
 * - 追加类型实现：`registerType` push；`replaceDefaultImplementation` 时 `asDefault`
 * - {@link MongoTypes} 缺条目则跳过，不改对应 registry
 *
 * 同一 registry 重复调用：核心按 ctor 幂等更新，不重复堆积。
 */
export function registerMongoDBTypes(
  registry: TASONTypeRegistry,
  options: RegisterMongoDBTypesOptions = {},
): TASONTypeRegistry {
  bindBson(options.bson ?? loadDefaultBson());

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
    const infos = mongoTypeInfoList(MongoTypes[spec.typeName]);
    if (infos.length === 0) continue;

    const replaceDefault =
      spec.strategy === "append" &&
      spec.canReplaceDefault === true &&
      shouldReplaceDefault(spec.typeName, options.replaceDefaultImplementation);

    for (let i = 0; i < infos.length; i++) {
      registry.registerType(spec.typeName, infos[i], undefined, {
        asDefault: replaceDefault && i === 0,
      });
    }
  }

  return registry;
}
