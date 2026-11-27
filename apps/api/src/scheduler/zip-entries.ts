import { inflateCapped } from "./capped-inflate";

const END = 0x06054b50;
const ENTRY = 0x02014b50;
const LOCAL = 0x04034b50;
const ZIP64 = 0xffffffff;

/**
 * Every entry of a zip file, from its central directory. `size` is the larger
 * of its stored and its declared unpacked size; `open()` unpacks it, and
 * throws when it unpacks past its declared size. Throws on bytes that are not
 * a zip, or a zip64 file.
 */
// ponytail: zip64 is refused. Read it when archives over 4 GB are on issues.
export function* zipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let end = bytes.length - 22;
  // The end record sits after a comment of up to 65,535 bytes.
  while (end >= 0 && u32(end) !== END) {
    if (bytes.length - end > 65_557) end = -1;
    else end--;
  }
  if (end < 0) throw new Error("Not a zip file");
  const count = u16(end + 10);
  let at = u32(end + 16);
  if (count === 0xffff || at === ZIP64) throw new Error("A zip64 file");
  for (let index = 0; index < count; index++) {
    if (at + 46 > bytes.length || u32(at) !== ENTRY) {
      throw new Error("The zip directory is broken");
    }
    const method = u16(at + 10);
    const stored = u32(at + 20);
    const declared = u32(at + 24);
    const nameLength = u16(at + 28);
    const local = u32(at + 42);
    if (stored === ZIP64 || declared === ZIP64 || local === ZIP64) {
      throw new Error("A zip64 file");
    }
    const path = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    at += 46 + nameLength + u16(at + 30) + u16(at + 32);
    if (local + 30 > bytes.length || u32(local) !== LOCAL) {
      throw new Error("A zip entry is broken");
    }
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + stored > bytes.length) throw new Error("The zip is cut off");
    const data = bytes.subarray(start, start + stored);
    yield {
      path,
      size: Math.max(stored, declared),
      open: () => {
        if (method === 8) return inflateCapped(data, declared);
        if (method === 0 && stored === declared) return data;
        throw new Error("A zip entry cannot be unpacked");
      },
    };
  }
}
