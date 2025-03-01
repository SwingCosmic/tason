import "reflect-metadata";

import TASONSerializer from "./TASONSerializer";
import TASONTypeRegistry from "./TASONTypeRegistry";
import { Types } from "./types";

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