import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const reviewerParam = z.object({
  taskId: z.string(),
  reviewerId: z.string(),
});

export const requestDesignReviewBody = z.object({
  reviewerId: z.string().min(1).openapi({
    description:
      "The workspace member asked to review. They must be able to open the task's team, and cannot be the caller.",
  }),
});
