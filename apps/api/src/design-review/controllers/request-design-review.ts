import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskDesignReviewTable,
  taskTable,
  workspaceUserTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { findDesignReviews } from "./find-design-reviews";

async function assertReviewerCanOpenTask(taskId: string, reviewerId: string) {
  const [eligible] = await db
    .select({ id: workspaceUserTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
        eq(workspaceUserTable.userId, reviewerId),
      ),
    )
    .where(
      and(
        eq(taskTable.id, taskId),
        projectAccessCondition(reviewerId, projectTable.id),
      ),
    )
    .limit(1);
  if (!eligible) {
    throw new HTTPException(400, {
      message: "Reviewer must be a workspace member who can open this team",
    });
  }
}

export async function requestDesignReview({
  taskId,
  reviewerId,
  requesterId,
}: {
  taskId: string;
  reviewerId: string;
  requesterId: string;
}) {
  await assertReviewerCanOpenTask(taskId, reviewerId);
  const requestedAt = new Date();
  await db
    .insert(taskDesignReviewTable)
    .values({ taskId, reviewerId, requesterId, requestedAt })
    .onConflictDoUpdate({
      target: [taskDesignReviewTable.taskId, taskDesignReviewTable.reviewerId],
      set: { requesterId, requestedAt, status: "pending", resolvedAt: null },
    });
  const [review] = await findDesignReviews(taskId, reviewerId);
  if (!review) throw new HTTPException(404, { message: "Task not found" });
  return review;
}
