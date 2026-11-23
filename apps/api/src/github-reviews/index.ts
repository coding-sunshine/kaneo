import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { callback } from "./controllers/callback";
import { connect } from "./controllers/connect";
import { getStatus } from "./controllers/get-status";
import { listPullRequests } from "./controllers/list-pull-requests";
import { deleteConnection } from "./connection";
import { getPullRequest } from "./controllers/get-pull-request";
import { getPullRequestChecks } from "./controllers/get-pull-request-checks";
import { listPullRequestConversation } from "./controllers/list-pull-request-conversation";
import { listPullRequestFiles } from "./controllers/list-pull-request-files";
import { addComment } from "./controllers/add-comment";
import { mergePullRequest } from "./controllers/merge-pull-request";
import { submitReview } from "./controllers/submit-review";
import {
  callbackQuery,
  commentBody,
  connectQuery,
  listQuery,
  mergeBody,
  pullParams,
  reviewBody,
} from "./schema";
import {
  checksSchema,
  conversationSchema,
  disconnectedSchema,
  filesSchema,
  mergedSchema,
  pullRequestSchema,
  reviewListSchema,
  reviewSubmittedSchema,
  statusSchema,
} from "./response";

const tags = ["GitHub Reviews"];
// Reviews act as the signed-in person on GitHub, so API keys are refused.
const needsSession = errorResponse("A user session is required");
const needsGithub = errorResponse(
  "GitHub is not connected or must be reconnected",
);

const statusRoute = createRoute({
  method: "get",
  operationId: "getGithubReviewsStatus",
  path: "/status",
  tags,
  summary: "Get GitHub reviews connection status",
  description:
    "Whether pull request reviews are configured on this instance and whether the signed-in user has a working GitHub connection.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Connection status", statusSchema),
    403: needsSession,
  },
});

const connectRoute = createRoute({
  method: "get",
  operationId: "connectGithubReviews",
  path: "/connect",
  tags,
  summary: "Connect a GitHub account",
  description:
    "Starts GitHub user authorization for the signed-in user and redirects the browser to GitHub. Open it as a page, not through fetch.",
  middleware: [requireUserSession] as const,
  request: { query: connectQuery },
  responses: {
    302: { description: "Redirects to GitHub to authorize" },
    403: needsSession,
    404: errorResponse("GitHub reviews are not configured"),
  },
});

const callbackRoute = createRoute({
  method: "get",
  operationId: "completeGithubReviewsConnection",
  path: "/callback",
  tags,
  summary: "Finish connecting a GitHub account",
  description:
    "GitHub redirects here after authorization. Verifies the state, stores the user's token, and returns the browser to the Reviews page.",
  middleware: [requireUserSession] as const,
  request: { query: callbackQuery },
  responses: {
    302: { description: "Redirects back to the web app" },
    400: errorResponse("The state did not match this browser session"),
    403: needsSession,
    502: errorResponse("GitHub rejected the authorization"),
  },
});

const disconnectRoute = createRoute({
  method: "delete",
  operationId: "disconnectGithubReviews",
  path: "/connection",
  tags,
  summary: "Disconnect the GitHub account",
  description: "Deletes the signed-in user's stored GitHub token.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Disconnected", disconnectedSchema),
    403: needsSession,
  },
});

const listRoute = createRoute({
  method: "get",
  operationId: "listGithubReviews",
  path: "/",
  tags,
  summary: "List pull requests to review",
  description:
    "Pull requests awaiting the user's review, authored by them, and ones they took part in, read from GitHub with the user's own token. A GitHub App user token only sees repositories where the Kaneo GitHub App is installed.",
  middleware: [requireUserSession] as const,
  request: { query: listQuery },
  responses: {
    200: jsonResponse("Pull requests by group", reviewListSchema),
    403: needsSession,
    409: needsGithub,
  },
});

const pullRoute = createRoute({
  method: "get",
  operationId: "getGithubPullRequest",
  path: "/pulls/{owner}/{repo}/{number}",
  tags,
  summary: "Get a pull request",
  description: "Pull request details read with the user's GitHub token.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("Get a pull request", pullRequestSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
  },
});

const filesRoute = createRoute({
  method: "get",
  operationId: "listGithubPullRequestFiles",
  path: "/pulls/{owner}/{repo}/{number}/files",
  tags,
  summary: "List changed files",
  description:
    "Changed files with GitHub's unified diff patch text. The patch is null for binary or very large files.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("List changed files", filesSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
  },
});

const checksRoute = createRoute({
  method: "get",
  operationId: "getGithubPullRequestChecks",
  path: "/pulls/{owner}/{repo}/{number}/checks",
  tags,
  summary: "Get CI checks",
  description:
    "Check runs and commit statuses for the pull request head commit.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("Get CI checks", checksSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
  },
});

const conversationRoute = createRoute({
  method: "get",
  operationId: "listGithubPullRequestConversation",
  path: "/pulls/{owner}/{repo}/{number}/conversation",
  tags,
  summary: "List conversation",
  description:
    "Issue comments, submitted reviews and inline review comments in time order. Inline comments carry their file path and line.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("List conversation", conversationSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
  },
});

const reviewRoute = createRoute({
  method: "post",
  operationId: "submitGithubPullRequestReview",
  path: "/pulls/{owner}/{repo}/{number}/reviews",
  tags,
  summary: "Submit a review",
  description:
    "Approve, request changes or comment. Posted to GitHub as the signed-in user.",
  middleware: [requireUserSession] as const,
  request: {
    params: pullParams,
    body: {
      content: { "application/json": { schema: reviewBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Submit a review", reviewSubmittedSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
    422: errorResponse("GitHub rejected the review"),
  },
});

const commentRoute = createRoute({
  method: "post",
  operationId: "addGithubPullRequestComment",
  path: "/pulls/{owner}/{repo}/{number}/comments",
  tags,
  summary: "Add a conversation comment",
  description: "Posts a comment on the pull request as the signed-in user.",
  middleware: [requireUserSession] as const,
  request: {
    params: pullParams,
    body: {
      content: { "application/json": { schema: commentBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Add a conversation comment", reviewSubmittedSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
    422: errorResponse("GitHub rejected the comment"),
  },
});

const mergeRoute = createRoute({
  method: "put",
  operationId: "mergeGithubPullRequest",
  path: "/pulls/{owner}/{repo}/{number}/merge",
  tags,
  summary: "Merge a pull request",
  description:
    "Merges the pull request as the signed-in user. GitHub answers 405 when it is not mergeable and 403 without permission.",
  middleware: [requireUserSession] as const,
  request: {
    params: pullParams,
    body: {
      content: { "application/json": { schema: mergeBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Merge a pull request", mergedSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    405: errorResponse("The pull request is not mergeable"),
    409: needsGithub,
    422: errorResponse("GitHub rejected the merge"),
  },
});

const githubReviews = apiRouter()
  .openapi(statusRoute, async (c) =>
    c.json(await getStatus(c.get("userId")), 200),
  )
  .openapi(connectRoute, (c) => connect(c, c.req.valid("query").returnTo))
  .openapi(callbackRoute, (c) => callback(c, c.req.valid("query")))
  .openapi(disconnectRoute, async (c) => {
    await deleteConnection(c.get("userId"));
    return c.json({ ok: true as const }, 200);
  })
  .openapi(pullRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await getPullRequest(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(filesRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await listPullRequestFiles(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(checksRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await getPullRequestChecks(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(conversationRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await listPullRequestConversation(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(reviewRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await submitReview(
        c.get("userId"),
        owner,
        repo,
        number,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(commentRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await addComment(
        c.get("userId"),
        owner,
        repo,
        number,
        c.req.valid("json").body,
      ),
      200,
    );
  })
  .openapi(mergeRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await mergePullRequest(
        c.get("userId"),
        owner,
        repo,
        number,
        c.req.valid("json").mergeMethod,
      ),
      200,
    );
  })
  .openapi(listRoute, async (c) => {
    const query = c.req.valid("query");
    return c.json(
      await listPullRequests(c.get("userId"), {
        includeDrafts: query.includeDrafts === "true",
        includeClosed: query.includeClosed === "true",
      }),
      200,
    );
  });

export default githubReviews;
