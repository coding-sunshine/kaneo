import { eq, sql } from "drizzle-orm";
import type { Transaction } from "../topic/controllers/flag-dependents";
import { columnTable } from "../database/schema";

/** The team's Triage status, added after the other statuses when it is missing. */
export async function ensureTriageColumn(tx: Transaction, projectId: string) {
  // Same lock key as column creation, so a concurrent run or column create
  // cannot add a second Triage status.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(1525, hashtext(${projectId}))`,
  );
  const columns = await tx
    .select({
      id: columnTable.id,
      slug: columnTable.slug,
      position: columnTable.position,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId));
  const existing = columns.find((column) => column.slug === "triage");
  if (existing) return existing.id;
  const [column] = await tx
    .insert(columnTable)
    .values({
      projectId,
      name: "Triage",
      slug: "triage",
      position: Math.max(-1, ...columns.map((column) => column.position)) + 1,
    })
    .returning({ id: columnTable.id });
  return column?.id;
}
