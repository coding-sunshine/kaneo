import { DESIGN_REVIEW_STATUSES } from "../database/schema";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const designReviewSchema = z
  .object({
    taskId: z.string(),
    reviewerId: z.string(),
    reviewerName: z.string().nullable(),
    requesterId: z.string().nullable(),
    status: z.enum(DESIGN_REVIEW_STATUSES).openapi({
      description: "`pending` until the reviewer approves it, then `approved`.",
    }),
    requestedAt: responseTimestamp,
    resolvedAt: nullableResponseTimestamp,
    slaDueAt: responseTimestamp.openapi({
      description:
        "When the review should be answered: two days after the request.",
    }),
  })
  .openapi("DesignReview");

export const designReviewListSchema = z.array(designReviewSchema);
