import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskDesignReviewTable } from "../../database/schema";

// Only a pending request can be withdrawn; an approval stays on record.
export async function withdrawDesignReview(taskId: string, reviewerId: string) {
  const match = and(
    eq(taskDesignReviewTable.taskId, taskId),
    eq(taskDesignReviewTable.reviewerId, reviewerId),
  );
  const removed = await db
    .delete(taskDesignReviewTable)
    .where(and(match, eq(taskDesignReviewTable.status, "pending")))
    .returning({ taskId: taskDesignReviewTable.taskId });
  if (removed.length) return { taskId, reviewerId };

  const [existing] = await db
    .select({ status: taskDesignReviewTable.status })
    .from(taskDesignReviewTable)
    .where(match)
    .limit(1);
  if (existing) {
    throw new HTTPException(409, {
      message: "An approved design review cannot be withdrawn",
    });
  }
  throw new HTTPException(404, { message: "Design review not found" });
}
