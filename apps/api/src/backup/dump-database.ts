import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import type { Client } from "pg";
import { COUNTED_TABLES, type TableCounts } from "./counted-tables";
import {
  DUMP_FORMAT_VERSION,
  type DumpHeader,
  quoteIdentifier,
  ROW_LINE,
  TABLE_LINE,
} from "./dump-format";
import { listTables } from "./list-tables";

const FETCH_SIZE = 1000;

export async function countTables(client: Client): Promise<TableCounts> {
  const counts: Partial<TableCounts> = {};
  // One client runs one query at a time.
  for (const [key, table] of Object.entries(COUNTED_TABLES)) {
    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${quoteIdentifier(table)}`,
    );
    counts[key as keyof TableCounts] = Number(rows[0]?.count ?? 0);
  }
  return counts as TableCounts;
}

async function write(out: PassThrough, line: string) {
  if (!out.write(`${line}\n`)) {
    await new Promise((resolve) => out.once("drain", resolve));
  }
}

/**
 * Writes every public table to a gzip'd file inside one read-only snapshot,
 * so rows and counts agree even while people keep working.
 */
export async function dumpDatabase(client: Client, filePath: string) {
  const out = new PassThrough();
  const done = pipeline(out, createGzip(), createWriteStream(filePath));
  let counts: TableCounts;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    counts = await countTables(client);
    const header: DumpHeader = {
      format: "kaneo-backup",
      version: DUMP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      counts,
    };
    await write(out, JSON.stringify(header));
    for (const table of await listTables(client)) {
      await write(out, `${TABLE_LINE}${JSON.stringify(table)}`);
      await client.query(
        `DECLARE backup_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS row FROM ${quoteIdentifier(table.name)} t`,
      );
      for (;;) {
        const { rows } = await client.query<{ row: string }>(
          `FETCH ${FETCH_SIZE} FROM backup_rows`,
        );
        for (const { row } of rows) await write(out, `${ROW_LINE}${row}`);
        if (rows.length < FETCH_SIZE) break;
      }
      await client.query("CLOSE backup_rows");
    }
    await client.query("COMMIT");
    out.end();
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    out.destroy(error as Error);
    await done.catch(() => {});
    throw error;
  }
  await done;
  return { counts, sizeBytes: (await stat(filePath)).size };
}
