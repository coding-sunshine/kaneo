import { Client } from "pg";
import { resolveDatabaseConnectionString } from "../database/resolve-database-url";

/** A dedicated connection to the live database, closed after `run`. */
export async function withLiveClient<T>(run: (client: Client) => Promise<T>) {
  const client = new Client({
    connectionString: resolveDatabaseConnectionString(),
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}
