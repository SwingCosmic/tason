import TASONSerializer from "./TASONSerializer";
import { Types } from "./types";

export interface TASON extends TASONSerializer {
  Serializer: typeof TASONSerializer;
  Types: typeof Types;
}

const TASONStatic: TASON = new TASONSerializer() as any;
TASONStatic.Serializer = TASONSerializer;
TASONStatic.Types = Types;

export default TASONStatic;