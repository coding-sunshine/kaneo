import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { approveDesignReview } from "./controllers/approve-design-review";
import { findDesignReviews } from "./controllers/find-design-reviews";
import { requestDesignReview } from "./controllers/request-design-review";
import { withdrawDesignReview } from "./controllers/withdraw-design-review";
import { designReviewListSchema, designReviewSchema } from "./response";
import { requestDesignReviewBody, reviewerParam, taskIdParam } from "./schema";

const listDesignReviewsRoute = createRoute({
  method: "get",
  operationId: "listDesignReviews",
  path: "/task/{taskId}",
  tags: ["Design Reviews"],
  summary: "List a task's design reviews",
  description:
    "Get everyone asked to review the task's design, oldest request first, with each review's state and SLA due time.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("Design reviews on the task", designReviewListSchema),
    403: errorResponse(
      "No access to the project, or missing task:read permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const requestDesignReviewRoute = createRoute({
  method: "post",
  operationId: "requestDesignReview",
  path: "/task/{taskId}",
  tags: ["Design Reviews"],
  summary: "Request a design review",
  description:
    "Ask a workspace member to review the task's design. The task then shows in their Needs my review list. Asking the same person again restarts the review as pending.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: requestDesignReviewBody } },
    },
  },
  responses: {
    200: jsonResponse("The pending design review", designReviewSchema),
    400: errorResponse(
      "The reviewer is not a workspace member who can open the team",
    ),
    403: errorResponse(
      "No access to the project, or missing task:update permission",
    ),
    404: errorResponse("Task not found"),
  },
});

const approveDesignReviewRoute = createRoute({
  method: "post",
  operationId: "approveDesignReview",
  path: "/task/{taskId}/approve",
  tags: ["Design Reviews"],
  summary: "Approve a design review",
  description:
    "Approve the caller's own pending design review on the task, which removes the task from their Needs my review list.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("The approved design review", designReviewSchema),
    403: errorResponse(
      "No access to the project, or missing task:read permission",
    ),
    404: errorResponse("Task not found, or no pending review for the caller"),
  },
});

const withdrawDesignReviewRoute = createRoute({
  method: "delete",
  operationId: "withdrawDesignReview",
  path: "/task/{taskId}/reviewer/{reviewerId}",
  tags: ["Design Reviews"],
  summary: "Withdraw a design review request",
  description: "Remove a reviewer's design review from the task.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: reviewerParam },
  responses: {
    200: jsonResponse(
      "The withdrawn review",
      z.object({ taskId: z.string(), reviewerId: z.string() }),
    ),
    403: errorResponse(
      "No access to the project, or missing task:update permission",
    ),
    404: errorResponse("Task or design review not found"),
  },
});

const designReview = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listDesignReviewsRoute, async (c) =>
    c.json(await findDesignReviews(c.req.valid("param").taskId), 200),
  )
  .openapi(requestDesignReviewRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { reviewerId } = c.req.valid("json");
    return c.json(
      await requestDesignReview({
        taskId,
        reviewerId,
        requesterId: c.get("userId"),
      }),
      200,
    );
  })
  .openapi(approveDesignReviewRoute, async (c) =>
    c.json(
      await approveDesignReview(c.req.valid("param").taskId, c.get("userId")),
      200,
    ),
  )
  .openapi(withdrawDesignReviewRoute, async (c) => {
    const { taskId, reviewerId } = c.req.valid("param");
    return c.json(await withdrawDesignReview(taskId, reviewerId), 200);
  });

export default designReview;
