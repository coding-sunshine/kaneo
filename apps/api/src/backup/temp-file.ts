import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A path in a fresh temporary folder, removed with its folder after `run`. */
export async function withTempFile<T>(
  name: string,
  run: (path: string) => Promise<T>,
) {
  const folder = await mkdtemp(join(tmpdir(), "kaneo-backup-"));
  try {
    return await run(join(folder, name));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
