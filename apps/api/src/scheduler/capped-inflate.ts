import { Gunzip, Inflate } from "fflate";

// Pushed this many bytes at a time, so one push inflates at most about 1000
// times as much (deflate's best ratio) before the size is checked again.
const CHUNK = 4096;

/**
 * Inflated deflate or gzip data, which its header says is `size` bytes. Throws
 * as soon as the data inflates past that size, so a header that understates
 * the size costs no more work than the size it states.
 */
export function inflateCapped(data: Uint8Array, size: number, gzip = false) {
  const out = new Uint8Array(size);
  let length = 0;
  const stream = gzip ? new Gunzip() : new Inflate();
  stream.ondata = (chunk) => {
    if (length + chunk.length > size) {
      throw new Error("The data is larger than its header says");
    }
    out.set(chunk, length);
    length += chunk.length;
  };
  for (let at = 0; at < data.length; at += CHUNK) {
    stream.push(data.subarray(at, at + CHUNK), at + CHUNK >= data.length);
  }
  return out.subarray(0, length);
}
