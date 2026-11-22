import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type db from "../database";
import { labelTable, taskTable } from "../database/schema";

type Reader = Pick<typeof db, "select">;

export const foreignLabelKey = (taskId: string, name: string) =>
  `${taskId}\0${name}`;

// Webhooks and importers attach labels by name. A name that belongs to
// another team's label must not become a label on this team's issue.
export async function foreignTeamLabels(
  reader: Reader,
  workspaceId: string,
  pairs: readonly { taskId: string; name: string }[],
) {
  const foreign = new Set<string>();
  if (pairs.length === 0) return foreign;
  const rows = await reader
    .select({ taskId: taskTable.id, name: labelTable.name })
    .from(labelTable)
    .innerJoin(taskTable, ne(taskTable.projectId, labelTable.projectId))
    .where(
      and(
        eq(labelTable.workspaceId, workspaceId),
        isNull(labelTable.taskId),
        isNotNull(labelTable.projectId),
        inArray(labelTable.name, [...new Set(pairs.map((p) => p.name))]),
        inArray(taskTable.id, [...new Set(pairs.map((p) => p.taskId))]),
      ),
    );
  for (const row of rows) foreign.add(foreignLabelKey(row.taskId, row.name));
  return foreign;
}
