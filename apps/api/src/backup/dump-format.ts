// A dump is gzip'd text, one record per line. The first line is the header;
// then each table is a "T" line with its columns, followed by one "R" line per
// row holding `row_to_json` output. JSON text never contains a raw newline.
export const DUMP_FORMAT_VERSION = 1;

export type DumpHeader = {
  format: "kaneo-backup";
  version: number;
  createdAt: string;
  counts: Record<string, number>;
};

export type DumpTable = { name: string; columns: string[] };

export const TABLE_LINE = "T\t";
export const ROW_LINE = "R\t";

export function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
