import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import type { Client } from "pg";
import {
  DUMP_FORMAT_VERSION,
  type DumpHeader,
  type DumpTable,
  quoteIdentifier,
  ROW_LINE,
  TABLE_LINE,
} from "./dump-format";
import { listTables } from "./list-tables";

const BATCH_SIZE = 500;

type Target = { name: string; columns: string[] };

export class InvalidDumpError extends Error {
  override name = "InvalidDump";
}

async function insertBatch(client: Client, target: Target, rows: string[]) {
  if (rows.length === 0) return;
  const columns = target.columns.map(quoteIdentifier).join(", ");
  const table = quoteIdentifier(target.name);
  await client.query(
    `INSERT INTO ${table} (${columns}) SELECT ${columns} FROM json_populate_recordset(NULL::${table}, $1::json)`,
    [`[${rows.join(",")}]`],
  );
  rows.length = 0;
}

async function dropForeignKeys(client: Client) {
  const { rows } = await client.query<{
    table: string;
    name: string;
    definition: string;
  }>(`
    SELECT cl.relname AS table, co.conname AS name,
           pg_get_constraintdef(co.oid) AS definition
    FROM pg_constraint co
    JOIN pg_class cl ON cl.oid = co.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE co.contype = 'f' AND n.nspname = 'public'
  `);
  for (const fk of rows) {
    await client.query(
      `ALTER TABLE ${quoteIdentifier(fk.table)} DROP CONSTRAINT ${quoteIdentifier(fk.name)}`,
    );
  }
  return rows;
}

async function resetSequences(client: Client) {
  const { rows } = await client.query<{ table: string; column: string }>(`
    SELECT c.relname AS table, a.attname AS column
    FROM pg_depend d
    JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
    JOIN pg_class c ON c.oid = d.refobjid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.refobjsubid
    WHERE n.nspname = 'public'
  `);
  for (const { table, column } of rows) {
    const t = quoteIdentifier(table);
    const col = quoteIdentifier(column);
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT max(${col}) FROM ${t}), 0) + 1, false)`,
      [t, column],
    );
  }
}

/**
 * Loads a dump into a database that already has the current schema. Foreign
 * keys come off for the load and go back on afterwards, so a dump with broken
 * references fails here instead of restoring quietly. Row triggers stay off
 * during the load so stored values are kept as they were.
 */
export async function restoreDump(client: Client, filePath: string) {
  const targets = new Map(
    (await listTables(client)).map((table) => [table.name, table]),
  );
  await client.query("BEGIN");
  try {
    const names = [...targets.keys()].map(quoteIdentifier).join(", ");
    if (names) await client.query(`TRUNCATE ${names} CASCADE`);
    const foreignKeys = await dropForeignKeys(client);
    for (const name of targets.keys()) {
      await client.query(
        `ALTER TABLE ${quoteIdentifier(name)} DISABLE TRIGGER USER`,
      );
    }

    const lines = createInterface({
      input: createReadStream(filePath).pipe(createGunzip()),
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    let header: DumpHeader | null = null;
    let target: Target | null = null;
    const rows: string[] = [];
    for await (const line of lines) {
      if (!header) {
        header = JSON.parse(line) as DumpHeader;
        if (
          header.format !== "kaneo-backup" ||
          header.version !== DUMP_FORMAT_VERSION
        ) {
          throw new InvalidDumpError("Unknown backup format");
        }
      } else if (line.startsWith(TABLE_LINE)) {
        if (target) await insertBatch(client, target, rows);
        const table = JSON.parse(line.slice(TABLE_LINE.length)) as DumpTable;
        const existing = targets.get(table.name);
        target = existing
          ? {
              name: table.name,
              columns: existing.columns.filter((column) =>
                table.columns.includes(column),
              ),
            }
          : null;
        rows.length = 0;
      } else if (line.startsWith(ROW_LINE)) {
        if (!target) continue;
        rows.push(line.slice(ROW_LINE.length));
        if (rows.length >= BATCH_SIZE) await insertBatch(client, target, rows);
      } else if (line !== "") {
        throw new InvalidDumpError("Unexpected line in backup");
      }
    }
    if (!header) throw new InvalidDumpError("Empty backup");
    if (target) await insertBatch(client, target, rows);

    for (const name of targets.keys()) {
      await client.query(
        `ALTER TABLE ${quoteIdentifier(name)} ENABLE TRIGGER USER`,
      );
    }
    for (const fk of foreignKeys) {
      await client.query(
        `ALTER TABLE ${quoteIdentifier(fk.table)} ADD CONSTRAINT ${quoteIdentifier(fk.name)} ${fk.definition}`,
      );
    }
    await resetSequences(client);
    await client.query("COMMIT");
    return header;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
