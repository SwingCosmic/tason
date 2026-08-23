import type { TASONTypeRegistry } from "tason";
import {
  loadDefaultBson,
  registerMongoDBTypes,
  type RegisterMongoDBTypesOptions,
} from "../src";

/** CJS bson，与 mongoose.mongo / mongodb 驱动同一副本。不写入持有点。 */
export const testBson = loadDefaultBson();

export function registerMongo(
  registry: TASONTypeRegistry,
  options: Omit<RegisterMongoDBTypesOptions, "bson"> = {},
) {
  return registerMongoDBTypes(registry, { bson: testBson, ...options });
}
