// Unfinished create-issue dialog, kept per workspace in this browser only.
export type CreateTaskDraft = {
  title: string;
  description: string;
  priority: string;
  assigneeId: string;
  startDate: string | null;
  dueDate: string | null;
  labels: { name: string; color: string }[];
  projectId: string;
  cycleId: string | null;
};

const key = (workspaceId: string) => `kaneo:create-task-draft:${workspaceId}`;

export function loadCreateTaskDraft(
  workspaceId: string,
): CreateTaskDraft | null {
  try {
    const raw = localStorage.getItem(key(workspaceId));
    return raw ? (JSON.parse(raw) as CreateTaskDraft) : null;
  } catch {
    return null;
  }
}

export function saveCreateTaskDraft(
  workspaceId: string,
  draft: CreateTaskDraft,
) {
  try {
    localStorage.setItem(key(workspaceId), JSON.stringify(draft));
  } catch {
    // Storage blocked or full: the draft is lost, nothing else breaks.
  }
}

export function clearCreateTaskDraft(workspaceId: string) {
  try {
    localStorage.removeItem(key(workspaceId));
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
