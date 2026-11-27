import { and, eq, sql } from "drizzle-orm";
import db, { schema } from "../database";

// Better Auth's own budget for wrong sign-in codes. Its session-mode checks
// skip it, so fresh-code checks count into the same columns.
const MAX_FAILED_CODES = 10;

const table = schema.twoFactorTable;
// The column holds UTC without a zone, as Better Auth writes it.
const utcNow = sql`(now() at time zone 'utc')`;

export async function isCodeEntryLocked(userId: string) {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(
      and(eq(table.userId, userId), sql`${table.lockedUntil} > ${utcNow}`),
    );
  return Boolean(row);
}

export async function recordWrongCode(userId: string) {
  await db
    .update(table)
    .set({
      failedVerificationCount: sql`coalesce(${table.failedVerificationCount}, 0) + 1`,
      lockedUntil: sql`case when coalesce(${table.failedVerificationCount}, 0) + 1 >= ${MAX_FAILED_CODES} then ${utcNow} + interval '15 minutes' else ${table.lockedUntil} end`,
    })
    .where(eq(table.userId, userId));
}

export async function clearWrongCodes(userId: string) {
  await db
    .update(table)
    .set({ failedVerificationCount: 0, lockedUntil: null })
    .where(eq(table.userId, userId));
}
