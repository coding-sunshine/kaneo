import type { Client } from "pg";
import type { DumpTable } from "./dump-format";

/** Ordinary tables in the public schema, with their writable columns. */
export async function listTables(client: Client): Promise<DumpTable[]> {
  const { rows } = await client.query<{ name: string; columns: string[] }>(`
    SELECT c.relname AS name,
           array_agg(a.attname::text ORDER BY a.attnum) AS columns
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attgenerated = ''
    GROUP BY c.relname
    ORDER BY c.relname
  `);
  return rows;
}
