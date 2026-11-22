import { Client } from "pg";
import { baseTestDatabaseUrl } from "./test-database-url";

// Worker databases are named after DATABASE_URL, so a second run with the same
// name resets the first run's rows mid-test and fails it at random. Hold a lock
// for the whole run so the second run stops with a clear message instead.
export default async function holdTestDatabaseLock() {
  const url = new URL(baseTestDatabaseUrl());
  const name = url.pathname.slice(1);
  url.pathname = "/postgres";
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const { rows } = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
    [`kaneo-integration:${name}`],
  );
  if (!rows[0]?.acquired) {
    await client.end();
    throw new Error(
      `Another integration run is using the ${name} databases. Wait for it to finish, or set DATABASE_URL to a different database name.`,
    );
  }
  return () => client.end();
}
