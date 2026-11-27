import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vite-plus/test";
import { type ZipEntry, zipChunks } from "./zip-chunks";

async function collect(entries: AsyncIterable<ZipEntry>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of zipChunks(entries, new Date(Date.UTC(2026, 0, 1))))
    chunks.push(chunk);
  const bytes = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return { chunks, files: unzipSync(bytes) };
}

describe("zipChunks", () => {
  it("yields bytes while entries are still being produced", async () => {
    let produced = 0;
    async function* entries(): AsyncGenerator<ZipEntry> {
      yield {
        name: "big.txt",
        parts: (async function* () {
          for (let i = 0; i < 2000; i++) {
            produced++;
            // Random text, so deflate has to emit as it goes.
            yield `${Math.random().toString(36)}${Math.random().toString(36)}\n`;
          }
        })(),
      };
      yield { name: "small.json", parts: ["[", "1", "]"] };
    }
    const seen: number[] = [];
    for await (const _ of zipChunks(entries(), new Date())) seen.push(produced);
    // The first bytes came out before the last part was produced.
    expect(seen[0]).toBeLessThan(2000);
  });

  it("writes every entry whole", async () => {
    const { files } = await collect(
      (async function* () {
        yield { name: "a.md", parts: ["# A\n", "", "text"] };
        yield { name: "b/c.json", parts: ['{"ok":true}'] };
      })(),
    );
    expect(strFromU8(files["a.md"]!)).toBe("# A\ntext");
    expect(JSON.parse(strFromU8(files["b/c.json"]!))).toEqual({ ok: true });
  });
});
