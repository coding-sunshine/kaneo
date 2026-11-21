import { subscribeToEvent } from "../events";
import { autoAddToCurrentCycle } from "./reconcile";

subscribeToEvent<{ taskId: string; projectId: string; newStatus: string }>(
  "task.status_changed",
  ({ taskId, projectId, newStatus }) =>
    autoAddToCurrentCycle(taskId, projectId, newStatus),
);
