import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";

export type UpNextReason =
  | { kind: "blocked"; blockers: string[]; hidden: boolean }
  | { kind: "cycle" }
  | { kind: "priority"; priority: string }
  | { kind: "due" }
  | { kind: "position" };

export type UpNextRow = { task: AssignedTask; reason: UpNextReason };

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const rank = (task: AssignedTask) => PRIORITY_RANK[task.priority] ?? 0;
const dueTime = (task: AssignedTask) =>
  task.dueDate ? Date.parse(task.dueDate) : Number.POSITIVE_INFINITY;
const position = (task: AssignedTask) =>
  task.position ?? Number.POSITIVE_INFINITY;
const isBlocked = (task: AssignedTask) =>
  task.blockedBy.length > 0 || task.hasHiddenBlocker;

// Each key decides only when every key before it ties: unblocked work first,
// then the running cycle, priority, due date, and manual position last.
const KEYS: Array<(task: AssignedTask) => number> = [
  (task) => (isBlocked(task) ? 1 : 0),
  (task) => (task.inCycle ? 0 : 1),
  (task) => -rank(task),
  dueTime,
  position,
];

function reasonFor(task: AssignedTask): UpNextReason {
  if (isBlocked(task))
    return {
      kind: "blocked",
      blockers: task.blockedBy,
      hidden: task.hasHiddenBlocker,
    };
  if (task.inCycle) return { kind: "cycle" };
  if (rank(task) > 0) return { kind: "priority", priority: task.priority };
  if (task.dueDate) return { kind: "due" };
  return { kind: "position" };
}

/** Home's Up next order, with the reason each task sits where it does. */
export function orderUpNext(tasks: AssignedTask[]): UpNextRow[] {
  return [...tasks]
    .sort((a, b) => {
      for (const key of KEYS) {
        const diff = key(a) - key(b);
        if (diff) return diff;
      }
      return 0;
    })
    .map((task) => ({ task, reason: reasonFor(task) }));
}
