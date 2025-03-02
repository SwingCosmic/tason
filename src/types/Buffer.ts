/// <reference types="node" />

type NodeBuffer = import("node:buffer").Buffer<ArrayBuffer>;
import { decode as decodeBase64 } from "base64-arraybuffer";
import { defineType } from "./TASONTypeInfo";

export class Buffer {
  readonly data: string;
  readonly type: "base64" | "hex";
  constructor(dataString: string) {
    let index = dataString.indexOf(",");
    if (index < 0) {
      throw new TypeError(`Invalid data string: '${dataString.slice(0, 20)} ...'`);
    }

    const type = dataString.slice(0, index).toLowerCase();
    const data = dataString.slice(index + 1);

    if (type === "base64") {
      this.type = type;
      this.data = data.trim();
      if (!/^[A-Za-z0-9\/+=]*$/.test(this.data)) {
        throw new TypeError("Invalid base64 string.");
      }
    } else if (type === "hex") {
      this.type = type;
      this.data = data.trim().toUpperCase();
      if (!/^[0-9a-fA-F]*$/.test(this.data)) {
        throw new TypeError("Invalid hex string.");
      }
    } else {
      throw new TypeError(`Invalid buffer type: ${type}`);
    }
  }

  toArrayBuffer(): ArrayBuffer {
    if (this.type === "base64") {
      return decodeBase64(this.data);
    } else {
      if (this.data.length % 2 === 1) {
        throw new RangeError(`Expect hex string to be an even number of characters`);
      }

      const bytes = new Uint8Array(this.data.length / 2);
      for (let i = 0; i < this.data.length; i += 2) {
        bytes[i / 2] = parseInt(this.data.substring(i, i + 2), 16);
      }
      return bytes.buffer;
    }
  }

  toNodeBuffer(): NodeBuffer {
    const _NodeBuffer = globalThis.Buffer;
    if (typeof _NodeBuffer !== "function") {
      throw new TypeError(
        "Node.js Buffer is not defined." +
          "If you are using in browser, please install 'buffer' package then add it to 'window'.",
      );
    }

    if (this.type === "base64") {
      return _NodeBuffer.from(this.data, "base64");
    } else {
      return _NodeBuffer.from(this.data, "hex");
    }
  }

  toString() {
    return [this.type, this.data].join(",");
  }
}


export const BufferTypeInfo = defineType<Buffer>({
  kind: "scalar",
  ctor: Buffer,
  serialize: value => value.toString(),
  deserialize: value => new Buffer(value),
});