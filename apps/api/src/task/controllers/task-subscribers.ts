import { and, eq } from "drizzle-orm";
import db from "../../database";
import { taskSubscriberTable } from "../../database/schema";

// Linear-style auto-subscribe: creator, assignee and commenters follow a task.
// Idempotent, so every path can call it without checking first.
export async function subscribeUsers(
  executor: Pick<typeof db, "insert">,
  taskId: string,
  userIds: ReadonlyArray<string | null | undefined>,
) {
  const rows = [...new Set(userIds.filter((id): id is string => !!id))].map(
    (userId) => ({ taskId, userId }),
  );
  if (rows.length)
    await executor
      .insert(taskSubscriberTable)
      .values(rows)
      .onConflictDoNothing();
}

export async function setSubscription(
  taskId: string,
  userId: string,
  subscribed: boolean,
) {
  if (subscribed) return subscribeUsers(db, taskId, [userId]);
  await db
    .delete(taskSubscriberTable)
    .where(
      and(
        eq(taskSubscriberTable.taskId, taskId),
        eq(taskSubscriberTable.userId, userId),
      ),
    );
}
