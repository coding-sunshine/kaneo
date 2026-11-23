// Maps the create-issue form to and from a saved draft (server-side, per user).
import type {
  TaskDraft,
  TaskDraftInput,
} from "@/fetchers/task-draft/task-drafts";

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

export function toDraftInput({
  title,
  description,
  projectId,
  ...properties
}: CreateTaskDraft): TaskDraftInput {
  return { title, description, projectId: projectId || null, properties };
}

export function fromDraft(draft: TaskDraft): CreateTaskDraft {
  const p = draft.properties as Partial<CreateTaskDraft>;
  return {
    title: draft.title,
    description: draft.description,
    projectId: draft.projectId ?? "",
    priority: p.priority ?? "no-priority",
    assigneeId: p.assigneeId ?? "",
    startDate: p.startDate ?? null,
    dueDate: p.dueDate ?? null,
    labels: p.labels ?? [],
    cycleId: p.cycleId ?? null,
  };
}
