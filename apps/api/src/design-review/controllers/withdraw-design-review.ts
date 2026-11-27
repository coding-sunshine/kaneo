import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskDesignReviewTable } from "../../database/schema";

export async function withdrawDesignReview(taskId: string, reviewerId: string) {
  const removed = await db
    .delete(taskDesignReviewTable)
    .where(
      and(
        eq(taskDesignReviewTable.taskId, taskId),
        eq(taskDesignReviewTable.reviewerId, reviewerId),
      ),
    )
    .returning({ taskId: taskDesignReviewTable.taskId });
  if (!removed.length) {
    throw new HTTPException(404, { message: "Design review not found" });
  }
  return { taskId, reviewerId };
}
