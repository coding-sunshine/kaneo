import { and, inArray, isNotNull } from "drizzle-orm";
import db from "../database";
import { taskTable } from "../database/schema";
import getAssignedTasks from "../task/controllers/get-assigned-tasks";
import getDoneTasks from "../task/controllers/get-done-tasks";

type Row = {
  id: string;
  title: string;
  projectId: string;
  projectSlug: string;
  number: number | null;
};

const itemOf = (row: Row) => ({
  id: row.id,
  title: row.title,
  ticket: `${row.projectSlug.toUpperCase()}-${row.number}`,
  projectId: row.projectId,
});

/**
 * The caller's own did, doing and blocked tickets, read from their activity
 * when they ask. Nothing is stored, published or sent, so the draft exists
 * only in the caller's response. It lists tickets, never people or counts.
 */
export async function buildStandupDraft(
  workspaceId: string,
  userId: string,
  days: number,
) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [done, open] = await Promise.all([
    getDoneTasks(workspaceId, userId, since),
    getAssignedTasks(workspaceId, userId),
  ]);
  const blocked = open.tasks.filter(
    (task) => task.blockedBy.length > 0 || task.hasHiddenBlocker,
  );
  const unblocked = open.tasks.filter((task) => !blocked.includes(task));
  const started = unblocked.length
    ? new Set(
        (
          await db
            .select({ id: taskTable.id })
            .from(taskTable)
            .where(
              and(
                inArray(
                  taskTable.id,
                  unblocked.map((task) => task.id),
                ),
                isNotNull(taskTable.startedAt),
              ),
            )
        ).map((row) => row.id),
      )
    : new Set<string>();
  return {
    did: done.tasks.map(itemOf),
    doing: unblocked.filter((task) => started.has(task.id)).map(itemOf),
    blocked: blocked.map(itemOf),
  };
}
