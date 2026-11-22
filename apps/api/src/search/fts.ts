import { type SQLWrapper, sql } from "drizzle-orm";

// Postgres full-text search over expression GIN indexes (no stored columns, so
// adding them never rewrites a table). The index expressions in schema.ts and
// the ones in the search queries are built here, so they stay identical, which
// is what lets the planner use the index. `left(.., 100000)` keeps one huge body
// under the 1MB tsvector limit. 'simple' means no stemming or stop words, so a
// prefix like `deplo` matches `deploy` and `deployment` alike.
const BODY_LIMIT = sql.raw("100000");

const text = (value: SQLWrapper) =>
  sql`to_tsvector('simple', left(coalesce(${value}, ''), ${BODY_LIMIT}))`;

// Title weighs more than body: A vs B in ts_rank.
export const titleBodyVector = (title: SQLWrapper, body: SQLWrapper) =>
  sql`(setweight(${text(title)}, 'A') || setweight(${text(body)}, 'B'))`;

export const bodyVector = text;

export type FtsQuery = { word: string; prefix: string };

// A query under 3 characters, or one with no word characters, is too short to
// rank; the caller keeps the `ilike` path for those. Tokens only hold letters
// and digits, so quoting them into a tsquery needs no escaping.
export function buildFtsQuery(raw: string): FtsQuery | null {
  if (raw.trim().length < 3) return null;
  const tokens = raw
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]+/gu)
    ?.slice(0, 16);
  if (!tokens?.length) return null;
  return {
    word: tokens.map((t) => `'${t}'`).join(" & "),
    prefix: tokens.map((t) => `'${t}':*`).join(" & "),
  };
}

// match: every word present (prefix allowed). score: 3-4 when whole words all
// match, 1-2 when only as prefixes; callers add their own exact-match tier.
export function ftsMatch(vector: SQLWrapper, q: FtsQuery) {
  const prefix = sql`to_tsquery('simple', ${q.prefix})`;
  const word = sql`to_tsquery('simple', ${q.word})`;
  return {
    match: sql<boolean>`${vector} @@ ${prefix}`,
    // ts_rank normalization 32 maps the rank into [0, 1).
    score: (wholeWordBase: number) =>
      sql<number>`CASE WHEN ${vector} @@ ${word} THEN ${wholeWordBase} + ts_rank(${vector}, ${word}, 32) ELSE ${wholeWordBase - 2} + ts_rank(${vector}, ${prefix}, 32) END`,
  };
}
