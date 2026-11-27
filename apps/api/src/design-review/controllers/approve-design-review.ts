import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskDesignReviewTable } from "../../database/schema";
import { findDesignReviews } from "./find-design-reviews";

// Only the named reviewer can approve: the row is looked up by the caller.
export async function approveDesignReview(taskId: string, reviewerId: string) {
  const approved = await db
    .update(taskDesignReviewTable)
    .set({ status: "approved", resolvedAt: new Date() })
    .where(
      and(
        eq(taskDesignReviewTable.taskId, taskId),
        eq(taskDesignReviewTable.reviewerId, reviewerId),
        eq(taskDesignReviewTable.status, "pending"),
      ),
    )
    .returning({ taskId: taskDesignReviewTable.taskId });
  const [review] = approved.length
    ? await findDesignReviews(taskId, reviewerId)
    : [];
  if (!review) {
    throw new HTTPException(404, {
      message: "No pending design review for you on this task",
    });
  }
  return review;
}
