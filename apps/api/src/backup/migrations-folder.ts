import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The API runs from src/backup in development and from one bundled
// dist/index.js in production; both sit beside apps/api/drizzle.
export function migrationsFolder() {
  const candidates = ["../drizzle", "../../drizzle"].map((path) =>
    fileURLToPath(new URL(path, import.meta.url)),
  );
  const found = candidates.find((path) =>
    existsSync(`${path}/meta/_journal.json`),
  );
  if (!found) throw new Error("Database migrations folder not found");
  return found;
}
