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
import { callbackQuery, connectQuery, listQuery } from "./schema";
import { disconnectedSchema, reviewListSchema, statusSchema } from "./response";

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
