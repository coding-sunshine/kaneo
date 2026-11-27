import { indexById } from "./index-by-id";

type Dated = {
  id: string;
  startDate: string | null;
  targetDate: string | null;
  dependsOnIds: string[];
};

/**
 * Projects whose dates overlap a project they wait on: they start before the
 * other one's target date. A missing date is not a conflict.
 * Returns, per project, the ids of the dependencies it overlaps.
 */
export function dependencyConflicts(projects: Dated[]) {
  const byId = indexById(projects);
  const conflicts = new Map<string, string[]>();
  for (const project of projects) {
    if (!project.startDate) continue;
    const start = new Date(project.startDate).getTime();
    const overlapping = project.dependsOnIds.filter((id) => {
      const target = byId.get(id)?.targetDate;
      return target != null && start < new Date(target).getTime();
    });
    if (overlapping.length) conflicts.set(project.id, overlapping);
  }
  return conflicts;
}
