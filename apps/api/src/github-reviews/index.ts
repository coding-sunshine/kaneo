import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { callback } from "./controllers/callback";
import { connect } from "./controllers/connect";
import { getStatus } from "./controllers/get-status";
import { listPullRequests } from "./controllers/list-pull-requests";
import { deleteConnection } from "./connection";
import { getPullRequest } from "./controllers/get-pull-request";
import { getPullRequestChecks } from "./controllers/get-pull-request-checks";
import { listPullRequestConversation } from "./controllers/list-pull-request-conversation";
import { comparePullRequestCommits } from "./controllers/compare-pull-request-commits";
import { getPullRequestFileContent } from "./controllers/get-file-content";
import { listPullRequestCommits } from "./controllers/list-pull-request-commits";
import { listPullRequestFiles } from "./controllers/list-pull-request-files";
import { addComment } from "./controllers/add-comment";
import { listReviewerCandidates } from "./controllers/list-reviewer-candidates";
import { closePullRequest } from "./controllers/close-pull-request";
import { convertPullRequestToDraft } from "./controllers/convert-to-draft";
import { listLabels } from "./controllers/list-repo-labels";
import { setPullRequestLabels } from "./controllers/set-pull-labels";
import { setPullRequestOwner } from "./controllers/set-pull-owner";
import { markPullRequestReady } from "./controllers/mark-ready-for-review";
import { mergePullRequest } from "./controllers/merge-pull-request";
import { requestPullRequestReviewers } from "./controllers/request-reviewers";
import { submitReview } from "./controllers/submit-review";
import {
  callbackQuery,
  commentBody,
  compareQuery,
  contentQuery,
  connectQuery,
  labelsBody,
  listQuery,
  mergeBody,
  ownerBody,
  pullParams,
  pullQuery,
  reviewBody,
  repoParams,
  reviewersBody,
} from "./schema";
import {
  checksSchema,
  commitsSchema,
  conversationSchema,
  fileContentSchema,
  closedSchema,
  disconnectedSchema,
  draftSchema,
  filesSchema,
  labelsSetSchema,
  mergedSchema,
  ownerSetSchema,
  pullRequestSchema,
  readySchema,
  reviewerCandidatesSchema,
  reviewListSchema,
  repoLabelsSchema,
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
  request: { params: pullParams, query: pullQuery },
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

const commitsRoute = createRoute({
  method: "get",
  operationId: "listGithubPullRequestCommits",
  path: "/pulls/{owner}/{repo}/{number}/commits",
  tags,
  summary: "List commits",
  description:
    "Commits of the pull request, oldest first. GitHub returns at most 250.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("List commits", commitsSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
  },
});

const compareRoute = createRoute({
  method: "get",
  operationId: "compareGithubPullRequestCommits",
  path: "/pulls/{owner}/{repo}/{number}/compare",
  tags,
  summary: "Changed files between two commits",
  description:
    "Files changed from base to head, to scope the diff to some of the pull request's commits.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams, query: compareQuery },
  responses: {
    200: jsonResponse("Changed files between two commits", filesSchema),
    403: needsSession,
    404: errorResponse(
      "Pull request not found or not visible to the Kaneo GitHub App",
    ),
    409: needsGithub,
  },
});

const contentRoute = createRoute({
  method: "get",
  operationId: "getGithubPullRequestFileContent",
  path: "/pulls/{owner}/{repo}/{number}/content",
  tags,
  summary: "Get a file's text at a commit",
  description:
    "The file's text at the given commit, used to expand unchanged lines. Content is null for binary or very large files.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams, query: contentQuery },
  responses: {
    200: jsonResponse("File text", fileContentSchema),
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

const notVisible = errorResponse(
  "Pull request not found or not visible to the Kaneo GitHub App",
);

const reviewerCandidatesRoute = createRoute({
  method: "get",
  operationId: "listGithubReviewerCandidates",
  path: "/pulls/{owner}/{repo}/{number}/reviewers",
  tags,
  summary: "List people who can be asked to review",
  description:
    "The repository's assignable users, as GitHub reports them for the signed-in user.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("List reviewer candidates", reviewerCandidatesSchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
  },
});

const requestReviewersRoute = createRoute({
  method: "post",
  operationId: "requestGithubPullRequestReviewers",
  path: "/pulls/{owner}/{repo}/{number}/reviewers",
  tags,
  summary: "Request reviewers",
  description:
    "Asks the given GitHub users to review, as the signed-in user. GitHub refuses the author and people without access.",
  middleware: [requireUserSession] as const,
  request: {
    params: pullParams,
    body: {
      content: { "application/json": { schema: reviewersBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Request reviewers", reviewSubmittedSchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
    422: errorResponse("GitHub rejected the review request"),
  },
});

const readyRoute = createRoute({
  method: "post",
  operationId: "markGithubPullRequestReady",
  path: "/pulls/{owner}/{repo}/{number}/ready",
  tags,
  summary: "Mark a draft ready for review",
  description:
    "Takes the pull request out of draft as the signed-in user, through GitHub's GraphQL API.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("Mark ready for review", readySchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
    422: errorResponse("GitHub rejected the change"),
  },
});

const draftRoute = createRoute({
  method: "post",
  operationId: "convertGithubPullRequestToDraft",
  path: "/pulls/{owner}/{repo}/{number}/draft",
  tags,
  summary: "Convert a pull request to draft",
  description:
    "Puts the pull request back into draft as the signed-in user, through GitHub's GraphQL API.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("Convert to draft", draftSchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
    422: errorResponse("GitHub rejected the change"),
  },
});

const closeRoute = createRoute({
  method: "post",
  operationId: "closeGithubPullRequest",
  path: "/pulls/{owner}/{repo}/{number}/close",
  tags,
  summary: "Close a pull request",
  description:
    "Closes the pull request without merging, as the signed-in user.",
  middleware: [requireUserSession] as const,
  request: { params: pullParams },
  responses: {
    200: jsonResponse("Close a pull request", closedSchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
    422: errorResponse("GitHub rejected the change"),
  },
});

const repoLabelsRoute = createRoute({
  method: "get",
  operationId: "listGithubRepoLabels",
  path: "/repos/{owner}/{repo}/labels",
  tags,
  summary: "List a repository's labels",
  description:
    "The repository's labels with their colours, as GitHub has them.",
  middleware: [requireUserSession] as const,
  request: { params: repoParams },
  responses: {
    200: jsonResponse("List repository labels", repoLabelsSchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
  },
});

const setLabelsRoute = createRoute({
  method: "put",
  operationId: "setGithubPullRequestLabels",
  path: "/pulls/{owner}/{repo}/{number}/labels",
  tags,
  summary: "Set a pull request's labels",
  description:
    "Replaces the pull request's labels with the given names, as the signed-in user.",
  middleware: [requireUserSession] as const,
  request: {
    params: pullParams,
    body: {
      content: { "application/json": { schema: labelsBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Set labels", labelsSetSchema),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
    422: errorResponse("GitHub rejected the labels"),
  },
});

const setOwnerRoute = createRoute({
  method: "put",
  operationId: "setGithubPullRequestOwner",
  path: "/pulls/{owner}/{repo}/{number}/owner",
  tags,
  summary: "Set a pull request's owner",
  description:
    "Sets who owns the pull request for everyone in the workspace, or clears the override with a null userId so the owner is the author again. Kaneo-only: nothing changes on GitHub.",
  middleware: [
    requireUserSession,
    workspaceAccess.fromBody(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: pullParams,
    body: {
      content: { "application/json": { schema: ownerBody } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Set owner", ownerSetSchema),
    400: errorResponse("The owner is not a member of the workspace"),
    403: needsSession,
    404: notVisible,
    409: needsGithub,
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
    const { workspaceId } = c.req.valid("query");
    return c.json(
      await getPullRequest(c.get("userId"), owner, repo, number, workspaceId),
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
  .openapi(commitsRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await listPullRequestCommits(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(compareRoute, async (c) => {
    const { owner, repo } = c.req.valid("param");
    const { base, head } = c.req.valid("query");
    return c.json(
      await comparePullRequestCommits(c.get("userId"), owner, repo, base, head),
      200,
    );
  })
  .openapi(contentRoute, async (c) => {
    const { owner, repo } = c.req.valid("param");
    const { path, ref } = c.req.valid("query");
    return c.json(
      await getPullRequestFileContent(c.get("userId"), owner, repo, path, ref),
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
  .openapi(reviewerCandidatesRoute, async (c) => {
    const { owner, repo } = c.req.valid("param");
    return c.json(
      await listReviewerCandidates(c.get("userId"), owner, repo),
      200,
    );
  })
  .openapi(requestReviewersRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await requestPullRequestReviewers(
        c.get("userId"),
        owner,
        repo,
        number,
        c.req.valid("json").reviewers,
      ),
      200,
    );
  })
  .openapi(readyRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await markPullRequestReady(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(draftRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await convertPullRequestToDraft(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(closeRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await closePullRequest(c.get("userId"), owner, repo, number),
      200,
    );
  })
  .openapi(repoLabelsRoute, async (c) => {
    const { owner, repo } = c.req.valid("param");
    return c.json(await listLabels(c.get("userId"), owner, repo), 200);
  })
  .openapi(setLabelsRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    return c.json(
      await setPullRequestLabels(
        c.get("userId"),
        owner,
        repo,
        number,
        c.req.valid("json").labels,
      ),
      200,
    );
  })
  .openapi(listRoute, async (c) => {
    const query = c.req.valid("query");
    return c.json(
      await listPullRequests(c.get("userId"), query.closed, query.workspaceId),
      200,
    );
  })
  .openapi(setOwnerRoute, async (c) => {
    const { owner, repo, number } = c.req.valid("param");
    const { workspaceId, userId } = c.req.valid("json");
    return c.json(
      await setPullRequestOwner(
        c.get("userId"),
        owner,
        repo,
        number,
        workspaceId,
        userId,
      ),
      200,
    );
  });

export default githubReviews;
