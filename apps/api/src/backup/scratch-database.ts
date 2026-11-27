import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { resolveDatabaseConnectionString } from "../database/resolve-database-url";
import { quoteIdentifier } from "./dump-format";
import { migrationsFolder } from "./migrations-folder";

// Fixed suffix: the scratch name never comes from a request.
const SCRATCH_SUFFIX = "_restore_test";

function withDatabase(connectionString: string, database: string) {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}

export function scratchDatabaseName(connectionString: string) {
  const live = decodeURIComponent(new URL(connectionString).pathname.slice(1));
  // Postgres truncates names at 63 bytes; keep the suffix intact.
  return `${live.slice(0, 63 - SCRATCH_SUFFIX.length)}${SCRATCH_SUFFIX}`;
}

async function onMaintenance(
  connectionString: string,
  run: (client: Client) => Promise<void>,
) {
  // CREATE and DROP DATABASE work from any database; the live one is reachable.
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

/**
 * Creates an empty scratch database beside the live one, applies the schema,
 * hands a client to `run`, and always drops the database afterwards.
 */
export async function withScratchDatabase<T>(
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const live = resolveDatabaseConnectionString();
  const name = quoteIdentifier(scratchDatabaseName(live));
  const drop = () =>
    onMaintenance(live, async (admin) => {
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    });

  await drop();
  await onMaintenance(live, async (admin) => {
    await admin.query(`CREATE DATABASE ${name}`);
  });
  try {
    const client = new Client({
      connectionString: withDatabase(live, scratchDatabaseName(live)),
    });
    await client.connect();
    try {
      await migrate(drizzle(client), { migrationsFolder: migrationsFolder() });
      return await run(client);
    } finally {
      await client.end();
    }
  } finally {
    await drop();
  }
}
