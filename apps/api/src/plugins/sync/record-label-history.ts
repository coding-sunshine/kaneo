import { activityTable } from "../../database/schema";
import type { IntegrationDatabase } from "../github/services/integration-task-scope";

/**
 * History rows for labels a provider webhook added to or removed from an
 * existing task. Written in the webhook's transaction and directly, not as
 * `task.label_assigned`, which would push the change back to the provider.
 */
export async function recordLabelHistory(
  database: IntegrationDatabase,
  taskId: string,
  actor: string,
  changes: { added?: string[]; removed?: string[] },
) {
  const rows = [
    ...(changes.added ?? []).map((name) => ({ addedLabels: [name] })),
    ...(changes.removed ?? []).map((name) => ({ removedLabels: [name] })),
  ];
  if (!rows.length) return;
  await database.insert(activityTable).values(
    rows.map((eventData) => ({
      taskId,
      type: "labels_changed",
      userId: null,
      externalUserName: actor,
      content: null,
      eventData,
    })),
  );
}
