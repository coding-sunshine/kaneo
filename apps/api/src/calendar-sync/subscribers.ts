import { subscribeToEvent } from "../events";
import {
  reconcileLinkedTasks,
  reconcileTask,
  syncUserTasks,
} from "./task-events";

// Events after which a task's due date, title, assignee or existence may differ.
const TASK_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.status_changed",
  "task.assignee_changed",
  "task.unassigned",
  "task.due_date_changed",
  "task.title_changed",
  // A move can unassign someone who cannot open the destination team.
  "task.moved",
];

for (const eventName of TASK_EVENTS) {
  subscribeToEvent<{ taskId?: string }>(eventName, async ({ taskId }) => {
    if (taskId) await reconcileTask(taskId);
  });
}

// Someone lost access to a team or left the workspace: their calendar must
// drop its tasks.
subscribeToEvent<{ projectId?: string }>(
  "task.bulk_unassigned",
  async ({ projectId }) => {
    if (projectId) await reconcileLinkedTasks({ projectId });
  },
);

subscribeToEvent<{ workspaceId?: string }>(
  "project_members.updated",
  async ({ workspaceId }) => {
    if (workspaceId) await reconcileLinkedTasks({ workspaceId });
  },
);

subscribeToEvent<{ userId: string }>(
  "calendar-sync.connected",
  async ({ userId }) => {
    await syncUserTasks(userId);
  },
);
