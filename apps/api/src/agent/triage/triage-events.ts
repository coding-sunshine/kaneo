import { subscribeToEvent } from "../../events";
import { suggestTriage } from "./suggest-triage";

// A suggestion never fails the change that triggered it.
const suggest = (taskId: string) =>
  suggestTriage(taskId).catch((error: unknown) => {
    console.error("AI triage suggestion failed:", error);
  });

subscribeToEvent<{ taskId: string }>("task.created", ({ taskId }) =>
  suggest(taskId),
);
subscribeToEvent<{ taskId: string; oldStatus: string; newStatus: string }>(
  "task.status_changed",
  ({ taskId, oldStatus, newStatus }) =>
    newStatus === "triage" && oldStatus !== "triage"
      ? suggest(taskId)
      : Promise.resolve(),
);
