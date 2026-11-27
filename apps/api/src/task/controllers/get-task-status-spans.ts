import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { activityTable, columnTable, taskTable } from "../../database/schema";
import { computeStatusSpans } from "../status-spans";

async function getTaskStatusSpans(taskId: string, now = new Date()) {
  const [task] = await db
    .select({
      status: taskTable.status,
      createdAt: taskTable.createdAt,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  const [rows, columns] = await Promise.all([
    db
      .select({
        createdAt: activityTable.createdAt,
        eventData: activityTable.eventData,
      })
      .from(activityTable)
      .where(
        and(
          eq(activityTable.taskId, taskId),
          eq(activityTable.type, "status_changed"),
        ),
      )
      .orderBy(asc(activityTable.createdAt), asc(activityTable.id)),
    db
      .select({ slug: columnTable.slug, name: columnTable.name })
      .from(columnTable)
      .where(eq(columnTable.projectId, task.projectId)),
  ]);

  const spans = computeStatusSpans(
    task,
    rows.map(({ createdAt, eventData }) => {
      const data = eventData as Record<string, unknown> | null;
      return {
        at: createdAt,
        oldStatus: data?.oldStatus,
        newStatus: data?.newStatus,
      };
    }),
    now,
  );

  const nameOf = (slug: string) => {
    const matching = columns.filter((column) => column.slug === slug);
    return matching.length === 1 ? (matching[0]?.name ?? null) : null;
  };
  return {
    spans: spans.map((span) => ({ ...span, name: nameOf(span.status) })),
  };
}

export default getTaskStatusSpans;
