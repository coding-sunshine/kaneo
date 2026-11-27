import { Gunzip, Inflate } from "fflate";

// Pushed this many bytes at a time, so one push inflates at most about 1000
// times as much (deflate's best ratio) before the size is checked again.
const CHUNK = 4096;
// Deflate never unpacks to more than about 1032 times its size. A header
// that says more is a lie, refused before anything is held for it.
const MAX_RATIO = 1032;

/**
 * Inflated deflate or gzip data, which its header says is `size` bytes. Throws
 * as soon as the data inflates past that size, so a header that understates
 * the size costs no more work than the size it states, and before inflating
 * when the size is more than deflate can unpack the data to.
 */
export function inflateCapped(data: Uint8Array, size: number, gzip = false) {
  if (size > data.length * MAX_RATIO + 1024) {
    throw new Error("The data says it unpacks to more than deflate can");
  }
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
