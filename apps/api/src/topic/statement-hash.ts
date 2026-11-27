import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { statementTable } from "../database/schema";

// The unique index keeps one statement a slot for each text of a document. A
// long text can state a second value for a slot: that statement's
// `contentHash` is the text's hash, `#` and the value's hash, so the index
// tells the two apart. Text hashes are hex and never hold a `#`.

/** The hash of the text a statement was written for. */
export const textHashOf = (contentHash: string) =>
  contentHash.split("#")[0] ?? "";

/** The `contentHash` of a further value of a slot on the same text. */
export const valueHash = (textHash: string, normalized: string) =>
  `${textHash}#${createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;

/** Statements written for the text with this hash. */
export const forText = (hash: string | AnyPgColumn) =>
  eq(sql`split_part(${statementTable.contentHash}, '#', 1)`, hash);
