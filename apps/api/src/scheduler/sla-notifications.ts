import { and, asc, eq, gt, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  projectTable,
  projectTriageResponsibleTable,
  taskTable,
} from "../database/schema";
import createNotification from "../notification/controllers/create-notification";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";

// Linear's docs say 24h; the parity brief asks for 1h.
export const SLA_WARNING_MS = 60 * 60 * 1000;

type Stage = "warning" | "breach";

// Open tasks that reached a stage and have not been notified for it yet.
async function dueTasks(stage: Stage, now: Date) {
  const stamp =
    stage === "warning"
      ? taskTable.slaWarningNotifiedAt
      : taskTable.slaBreachedAt;
  const horizon =
    stage === "warning" ? new Date(now.getTime() + SLA_WARNING_MS) : now;
  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      userId: taskTable.userId,
      projectId: taskTable.projectId,
      dueAt: taskTable.slaDueAt,
      teamName: projectTable.name,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        isNotNull(taskTable.slaDueAt),
        lte(taskTable.slaDueAt, horizon),
        isNull(stamp),
        // A task already past its deadline skips the warning and gets only the breach.
        stage === "warning" ? gt(taskTable.slaDueAt, now) : undefined,
        openTask(),
        workspaceIsActive(projectTable.workspaceId),
      ),
    )
    .orderBy(asc(taskTable.slaDueAt));
}

// Done, canceled and archived tasks no longer owe an SLA.
function openTask() {
  return and(
    ne(taskTable.status, "archived"),
    ne(taskTable.status, "canceled"),
    ne(taskTable.status, "done"),
    sql`(${columnTable.isFinal} is null or ${columnTable.isFinal} = false)`,
    isNull(taskTable.archivedAt),
  );
}

async function recipients(task: { userId: string | null; projectId: string }) {
  if (task.userId) return [task.userId];
  const rows = await db
    .select({ userId: projectTriageResponsibleTable.userId })
    .from(projectTriageResponsibleTable)
    .where(eq(projectTriageResponsibleTable.projectId, task.projectId));
  return rows.map((row) => row.userId);
}

async function notifyStage(
  stage: Stage,
  task: Awaited<ReturnType<typeof dueTasks>>[number],
) {
  const stamp =
    stage === "warning"
      ? { slaWarningNotifiedAt: new Date() }
      : { slaBreachedAt: new Date() };
  // Claim first: an update that matches the same unstamped deadline wins once.
  const [claimed] = await db
    .update(taskTable)
    .set(stamp)
    .where(
      and(
        eq(taskTable.id, task.id),
        task.dueAt ? eq(taskTable.slaDueAt, task.dueAt) : undefined,
        isNull(
          stage === "warning"
            ? taskTable.slaWarningNotifiedAt
            : taskTable.slaBreachedAt,
        ),
      ),
    )
    .returning({ id: taskTable.id });
  if (!claimed) return;
  for (const userId of await recipients(task)) {
    await createNotification({
      userId,
      type: stage === "warning" ? "sla_warning" : "sla_breach",
      eventData: {
        taskTitle: task.title,
        teamName: task.teamName,
        projectId: task.projectId,
        slaDueAt: task.dueAt?.toISOString() ?? null,
      },
      resourceId: task.id,
      resourceType: "task",
    });
  }
}

export async function checkSlaNotifications(
  now = new Date(),
): Promise<{ degraded: boolean }> {
  let degraded = false;
  // Breach first so an overdue task never also gets a warning in the same tick.
  for (const stage of ["breach", "warning"] as const) {
    try {
      for (const task of await dueTasks(stage, now)) {
        try {
          await notifyStage(stage, task);
        } catch (error) {
          degraded = true;
          console.error("Failed to send SLA notification", {
            taskId: task.id,
            stage,
            error,
          });
        }
      }
    } catch (error) {
      degraded = true;
      console.error("Failed to query tasks for SLA notifications", {
        stage,
        error,
      });
    }
  }
  return { degraded };
}
