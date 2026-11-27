import type { TaskRecurrence } from "./recurrence";

type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string | null;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

type TaskCustomFieldValue = {
  fieldId: string;
  value: string | null;
};

type Task = {
  id: string;
  /** Team key when a list mixes teams (cross-team project issues). */
  teamSlug?: string;
  title: string;
  number: number | null;
  description: string | null;
  descriptionDeferred?: boolean;
  status: string;
  priority: string | null;
  /** Points on the team's estimate scale; null when unestimated. */
  estimate?: number | null;
  startDate: string | null;
  dueDate: string | null;
  recurrence?: TaskRecurrence | null;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
  snoozedUntil?: string | null;
  /** Linear's workflow timestamps, stamped by the database on status changes. */
  startedAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;
  slaDueAt?: string | null;
  startedTriageAt?: string | null;
  triagedAt?: string | null;
  /** When the task entered its current status; null on public boards. */
  statusSince?: string | null;
  creatorId?: string | null;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  projectId: string;
  workProjectId?: string | null;
  workProjectMilestoneId?: string | null;
  cycleId?: string | null;
  columnId?: string | null;
  isSubtask?: boolean;
  subtaskCounts?: { completed: number; total: number };
  labels?: TaskLabel[];
  externalLinks?: TaskExternalLink[];
  customFieldValues?: TaskCustomFieldValue[];
};

export default Task;
