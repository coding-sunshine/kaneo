import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type db from "../../database";
import {
  columnTable,
  issueTemplateTable,
  projectTable,
} from "../../database/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Linear's "copy settings from": statuses, estimates, cycle settings and issue
// templates. Labels are workspace-wide; custom fields, integrations and
// workflow rules stay with the source team.
export async function copyProjectSettings(
  tx: Transaction,
  {
    sourceId,
    targetId,
    workspaceId,
  }: { sourceId: string; targetId: string; workspaceId: string },
) {
  const [source] = await tx
    .select()
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, sourceId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!source) {
    throw new HTTPException(404, { message: "Source project not found" });
  }

  const [updated] = await tx
    .update(projectTable)
    .set({
      includeSubtasks: source.includeSubtasks,
      autoArchiveMonths: source.autoArchiveMonths,
      cyclesEnabled: source.cyclesEnabled,
      cycleDurationWeeks: source.cycleDurationWeeks,
      cycleCooldownWeeks: source.cycleCooldownWeeks,
      cycleStartDay: source.cycleStartDay,
      cycleUpcomingCount: source.cycleUpcomingCount,
      cycleAutoAddStarted: source.cycleAutoAddStarted,
      cycleAutoAddCompleted: source.cycleAutoAddCompleted,
      cycleAutoRollover: source.cycleAutoRollover,
      estimateType: source.estimateType,
      estimateExtended: source.estimateExtended,
      estimateAllowZero: source.estimateAllowZero,
      estimateCountUnestimated: source.estimateCountUnestimated,
    })
    .where(eq(projectTable.id, targetId))
    .returning();

  const sourceColumns = await tx
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, sourceId))
    .orderBy(asc(columnTable.position));
  const columnIdMap = new Map<string, string>();
  if (sourceColumns.length > 0) {
    // The target is new: its seeded default statuses give way to the copy.
    await tx.delete(columnTable).where(eq(columnTable.projectId, targetId));
    for (const column of sourceColumns) {
      const [copy] = await tx
        .insert(columnTable)
        .values({
          projectId: targetId,
          name: column.name,
          slug: column.slug,
          position: column.position,
          icon: column.icon,
          color: column.color,
          isFinal: column.isFinal,
        })
        .returning({ id: columnTable.id });
      if (copy) columnIdMap.set(column.id, copy.id);
    }
  }

  const templates = await tx
    .select()
    .from(issueTemplateTable)
    .where(eq(issueTemplateTable.projectId, sourceId));
  for (const template of templates) {
    await tx.insert(issueTemplateTable).values({
      name: template.name,
      title: template.title,
      description: template.description,
      priority: template.priority,
      assigneeId: template.assigneeId,
      labels: template.labels,
      position: template.position,
      projectId: targetId,
      columnId: template.columnId
        ? (columnIdMap.get(template.columnId) ?? null)
        : null,
    });
  }

  return updated;
}
