/**
 * 真 ESM：`import from 'bson'` 与 `mongoose.mongo` 不是同一 class。
 * 持有点默认空；loadDefaultBson() 只取值、不绑定。
 */
import assert from "node:assert/strict";
import { Long as EsmLong, ObjectId as EsmObjectId } from "bson";
import mongoose from "mongoose";
import {
  getBson,
  isBsonBound,
  loadDefaultBson,
} from "../lib/bson-ns.js";

assert.equal(isBsonBound(), false);
assert.throws(() => getBson(), /bson is not bound/);

const def = loadDefaultBson();
assert.equal(isBsonBound(), false, "loadDefaultBson must not bind the holder");

assert.equal(def.Long, mongoose.mongo.Long);
assert.notEqual(def.Long, EsmLong);
assert.equal(def.ObjectId, mongoose.mongo.ObjectId);
assert.notEqual(def.ObjectId, EsmObjectId);

const foreign = mongoose.mongo.Long.fromString("6571037680684232705");
assert.equal(foreign instanceof EsmLong, false);
assert.equal(foreign instanceof def.Long, true);
assert.equal(EsmLong.isLong(foreign), true);

console.log("esm-driver-bson: ok");
