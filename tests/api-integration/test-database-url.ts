import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function stripEnvValueQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function deriveTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName || databaseName.endsWith("_test")) {
    return connectionString;
  }

  url.pathname = `/${databaseName}_test`;
  return url.toString();
}

// Each Vitest worker gets its own database so test files can run in parallel
// without resetting each other's rows: kaneo_test becomes kaneo_w3_test.
export function workerTestDatabaseUrl(connectionString: string) {
  const poolId = process.env.VITEST_POOL_ID;
  if (!poolId) {
    return connectionString;
  }

  const url = new URL(connectionString);
  url.pathname = url.pathname.replace(/_test$/, `_w${poolId}_test`);
  return url.toString();
}

export function assertTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Integration tests require DATABASE_URL to use a database name ending in _test (got "${databaseName}")`,
    );
  }
}

function readDatabaseUrlFromEnvFile() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(currentDir, "../../.env");

  if (!existsSync(envPath)) {
    return null;
  }

  const envFile = readFileSync(envPath, "utf8");
  const match = envFile.match(/^DATABASE_URL=(.+)$/m);
  const raw = match?.[1]?.trim();
  return raw ? stripEnvValueQuotes(raw) : null;
}

const defaultTestDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/kaneo_test";

// The shared database name before the per-worker suffix, e.g. kaneo_test.
export function baseTestDatabaseUrl() {
  const envDatabaseUrl = process.env.DATABASE_URL?.trim();
  const fromEnv = envDatabaseUrl ? stripEnvValueQuotes(envDatabaseUrl) : "";
  return deriveTestDatabaseUrl(
    fromEnv || readDatabaseUrlFromEnvFile() || defaultTestDatabaseUrl,
  );
}
