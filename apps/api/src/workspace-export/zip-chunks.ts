import { strToU8, Zip, ZipDeflate } from "fflate";

export type ZipEntry = {
  name: string;
  parts: AsyncIterable<string> | Iterable<string>;
};

/**
 * Zips entries as they are produced and yields the compressed bytes as soon
 * as fflate emits them. One entry is open at a time, so memory holds one
 * part, not the archive.
 */
export async function* zipChunks(
  entries: AsyncIterable<ZipEntry>,
  mtime: Date,
): AsyncGenerator<Uint8Array> {
  const ready: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else ready.push(chunk);
  });
  function* take() {
    if (failure) throw failure;
    yield* ready.splice(0);
  }
  for await (const entry of entries) {
    const file = new ZipDeflate(entry.name, { level: 6 });
    file.mtime = mtime;
    zip.add(file);
    for await (const part of entry.parts) {
      if (part) file.push(strToU8(part));
      yield* take();
    }
    file.push(new Uint8Array(0), true);
    yield* take();
  }
  zip.end();
  yield* take();
}
