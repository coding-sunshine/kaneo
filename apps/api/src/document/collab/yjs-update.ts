import { HTTPException } from "hono/http-exception";
import * as Y from "yjs";

/** The bytes of a Yjs update sent as base64, or 400 when they are not one. */
export function readUpdate(base64: string) {
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  try {
    Y.applyUpdate(new Y.Doc(), bytes);
  } catch {
    throw new HTTPException(400, { message: "Not a Yjs update" });
  }
  return bytes;
}

export const toBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString("base64");
