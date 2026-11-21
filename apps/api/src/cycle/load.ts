import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { cycleTable, taskTable } from "../database/schema";
import { UNSTARTED } from "./reconcile";

// Linear's cycle scope: every issue but canceled and archived ones.
export async function loadCycles(where: ReturnType<typeof eq>) {
  const rows = await db
    .select()
    .from(cycleTable)
    .where(where)
    .orderBy(desc(cycleTable.number));
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      id: taskTable.cycleId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`(count(*) filter (where ${taskTable.status} = 'done'))::int`,
      started: sql<number>`(count(*) filter (where ${taskTable.status} not in ('done', ${sql.join(
        UNSTARTED.map((s) => sql`${s}`),
        sql`, `,
      )})))::int`,
    })
    .from(taskTable)
    .where(
      and(
        inArray(
          taskTable.cycleId,
          rows.map((r) => r.id),
        ),
        isNull(taskTable.archivedAt),
        notInArray(taskTable.status, ["archived", "canceled"]),
      ),
    )
    .groupBy(taskTable.cycleId);
  const byId = new Map(counts.map((c) => [c.id, c]));
  return rows.map((row) => {
    const c = byId.get(row.id);
    return {
      ...row,
      progress: {
        total: c?.total ?? 0,
        started: c?.started ?? 0,
        done: c?.done ?? 0,
      },
    };
  });
}

export async function loadCycle(id: string) {
  const [cycle] = await loadCycles(eq(cycleTable.id, id));
  if (!cycle) throw new HTTPException(404, { message: "Cycle not found" });
  return cycle;
}
