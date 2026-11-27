import { and, asc, eq } from "drizzle-orm";
import db from "../../database";
import { taskDesignReviewTable, userTable } from "../../database/schema";
import { designReviewSlaDueAt } from "../sla";

export async function findDesignReviews(taskId: string, reviewerId?: string) {
  const rows = await db
    .select({
      taskId: taskDesignReviewTable.taskId,
      reviewerId: taskDesignReviewTable.reviewerId,
      reviewerName: userTable.name,
      requesterId: taskDesignReviewTable.requesterId,
      status: taskDesignReviewTable.status,
      requestedAt: taskDesignReviewTable.requestedAt,
      resolvedAt: taskDesignReviewTable.resolvedAt,
    })
    .from(taskDesignReviewTable)
    .leftJoin(userTable, eq(userTable.id, taskDesignReviewTable.reviewerId))
    .where(
      and(
        eq(taskDesignReviewTable.taskId, taskId),
        reviewerId
          ? eq(taskDesignReviewTable.reviewerId, reviewerId)
          : undefined,
      ),
    )
    .orderBy(asc(taskDesignReviewTable.requestedAt));
  return rows.map((row) => ({
    ...row,
    slaDueAt: designReviewSlaDueAt(row.requestedAt),
  }));
}
