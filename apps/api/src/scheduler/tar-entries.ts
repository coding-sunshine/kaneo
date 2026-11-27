const BLOCK = 512;

const field = (bytes: Uint8Array, from: number, to: number) => {
  const end = bytes.subarray(from, to).indexOf(0);
  return new TextDecoder().decode(
    bytes.subarray(from, end === -1 ? to : from + end),
  );
};

/** Whether the bytes start with a ustar (POSIX or GNU) tar header. */
export const isTar = (bytes: Uint8Array) =>
  bytes.length >= BLOCK && field(bytes, 257, 262) === "ustar";

/**
 * Every entry of a tar file, in order. `file` is false for directories, links
 * and extended headers. Throws on a header that is cut off or has no size.
 */
// ponytail: GNU long-name and pax headers are skipped, so a path over 100
// characters shows cut short. Read them when long paths matter.
export function* tarEntries(bytes: Uint8Array) {
  let at = 0;
  while (at + BLOCK <= bytes.length) {
    const header = bytes.subarray(at, at + BLOCK);
    if (header.every((byte) => byte === 0)) return;
    if (field(header, 257, 262) !== "ustar") throw new Error("Not a tar file");
    const size = field(header, 124, 136).trim();
    if (!/^[0-7]+$/.test(size)) throw new Error("A tar entry has no size");
    const length = Number.parseInt(size, 8);
    const start = at + BLOCK;
    if (start + length > bytes.length)
      throw new Error("The tar file is cut off");
    // POSIX ustar keeps the start of a long path in the prefix field.
    const prefix = header[262] === 0 ? field(header, 345, 500) : "";
    const name = field(header, 0, 100);
    const type = header[156];
    yield {
      path: prefix ? `${prefix}/${name}` : name,
      file: type === 0 || type === 0x30,
      bytes: bytes.subarray(start, start + length),
    };
    at = start + Math.ceil(length / BLOCK) * BLOCK;
  }
}
