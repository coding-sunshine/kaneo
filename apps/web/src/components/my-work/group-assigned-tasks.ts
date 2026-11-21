import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { DUE_BUCKETS, type DueBucket, getDueBucket } from "./due-bucket";

export type AssignedTaskGroup = {
  id: string;
  // Set for due-date groups; project groups are labelled by `title`.
  bucket?: DueBucket;
  title?: string;
  status?: string;
  statusIcon?: string | null;
  tasks: AssignedTask[];
};

export function groupAssignedTasksByDueDate(
  tasks: AssignedTask[],
  now = new Date(),
): AssignedTaskGroup[] {
  const byBucket = new Map<DueBucket, AssignedTask[]>();

  for (const task of tasks) {
    const bucket = getDueBucket(task.dueDate, now);
    const group = byBucket.get(bucket) ?? [];
    group.push(task);
    byBucket.set(bucket, group);
  }

  return DUE_BUCKETS.flatMap((bucket) => {
    const group = byBucket.get(bucket);
    return group ? [{ id: bucket, bucket, tasks: group }] : [];
  });
}

// Groups appear in the order their first task does, which keeps the project
// with the most pressing work on top.
export function groupAssignedTasksByProject(
  tasks: AssignedTask[],
): AssignedTaskGroup[] {
  const byProject = new Map<string, AssignedTaskGroup>();

  for (const task of tasks) {
    const group = byProject.get(task.projectId) ?? {
      id: task.projectId,
      title: task.projectName,
      tasks: [],
    };
    group.tasks.push(task);
    byProject.set(task.projectId, group);
  }

  return [...byProject.values()];
}

const STATUS_ORDER = ["in-progress", "in-review", "todo", "to-do", "backlog"];

// Linear's My issues order: active work first, backlog last.
export function groupAssignedTasksByStatus(
  tasks: AssignedTask[],
): AssignedTaskGroup[] {
  const byStatus = new Map<string, AssignedTaskGroup>();

  for (const task of tasks) {
    const group = byStatus.get(task.status) ?? {
      id: task.status,
      title: task.statusName ?? task.status,
      status: task.status,
      statusIcon: task.statusIcon,
      tasks: [],
    };
    group.tasks.push(task);
    byStatus.set(task.status, group);
  }

  const rank = (id: string) => {
    const i = STATUS_ORDER.indexOf(id);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  return [...byStatus.values()].sort((a, b) => rank(a.id) - rank(b.id));
}
