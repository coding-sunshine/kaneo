import { statusCategory } from "@/lib/status-category";

export type BlockingRelation = {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
};

type ProjectTaskColumns = {
  columns: ReadonlyArray<{
    id: string;
    slug?: string;
    isFinal: boolean;
    tasks: ReadonlyArray<{ id: string }>;
  }>;
  plannedTasks?: ReadonlyArray<{ id: string }>;
  archivedTasks?: ReadonlyArray<{ id: string }>;
};

function isColumnClosed(column: {
  id: string;
  slug?: string;
  isFinal: boolean;
}): boolean {
  if (column.isFinal) return true;
  const category = statusCategory({
    id: column.slug ?? column.id,
    isFinal: column.isFinal,
  });
  return category === "completed" || category === "canceled";
}

/**
 * Task IDs blocked by at least one open "blocks" relation
 * (`sourceTaskId` blocks `targetTaskId`).
 */
export function getBlockedTaskIds(
  project: ProjectTaskColumns | null | undefined,
  relations: readonly BlockingRelation[] | null | undefined,
): Set<string> {
  const blocked = new Set<string>();
  if (!project || !relations?.length) return blocked;

  const openTaskIds = new Set<string>();
  for (const column of project.columns) {
    if (isColumnClosed(column)) continue;
    for (const task of column.tasks) {
      openTaskIds.add(task.id);
    }
  }
  for (const task of project.plannedTasks ?? []) {
    openTaskIds.add(task.id);
  }

  for (const relation of relations) {
    if (relation.relationType !== "blocks") continue;
    if (relation.sourceTaskId === relation.targetTaskId) continue;
    if (openTaskIds.has(relation.sourceTaskId)) {
      blocked.add(relation.targetTaskId);
    }
  }

  return blocked;
}
