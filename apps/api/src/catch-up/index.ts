import { HTTPException } from "hono/http-exception";
import { readerOf } from "../agent/cite-messages";
import { isAgentEnabled } from "../agent/openrouter";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { catchUp } from "./catch-up";
import { getCatchUpPreference, setCatchUpPreference } from "./preference";
import {
  catchUpBody,
  catchUpPreferenceSchema,
  catchUpSchema,
  workspaceParam,
} from "./schema";

const tags = ["Catch-up"];
const middleware = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["read"] }),
] as const;
const json = <T>(schema: T) => ({
  content: { "application/json": { schema } },
  required: true,
});
const common = {
  403: errorResponse("Missing permission"),
  404: errorResponse("AI is off, or the workspace was not found"),
};

const catchUpRoute = createRoute({
  method: "post",
  operationId: "catchUp",
  path: "/workspace/{workspaceId}",
  tags,
  summary: "What did I miss",
  description:
    "A private summary of your unread channels, your threads and the tickets you follow over the last `hours`. Channels marked no AI are skipped, and your direct messages too unless you opted in. Each bullet links to a message or ticket; nothing is stored or shown to anyone else, and no person is ranked.",
  middleware: [...middleware] as const,
  request: { params: workspaceParam, body: json(catchUpBody) },
  responses: {
    200: jsonResponse("Catch-up", catchUpSchema),
    429: errorResponse("AI budget used up"),
    502: errorResponse("The model's answer could not be read"),
    ...common,
  },
});

const getPreferenceRoute = createRoute({
  method: "get",
  operationId: "getCatchUpPreference",
  path: "/workspace/{workspaceId}/preference",
  tags,
  summary: "My catch-up settings",
  description:
    "Whether AI answers for you (catch-up, the assistant's search) may read your direct messages.",
  middleware: [...middleware] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("Settings", catchUpPreferenceSchema),
    ...common,
  },
});

const setPreferenceRoute = createRoute({
  method: "put",
  operationId: "setCatchUpPreference",
  path: "/workspace/{workspaceId}/preference",
  tags,
  summary: "Change my catch-up settings",
  description:
    "Opt your direct messages in or out of AI answers for you: your catch-up and the assistant's search.",
  middleware: [...middleware] as const,
  request: { params: workspaceParam, body: json(catchUpPreferenceSchema) },
  responses: {
    200: jsonResponse("Settings", catchUpPreferenceSchema),
    ...common,
  },
});

const router = apiRouter();
router.use("*", async (_c, next) => {
  if (!isAgentEnabled()) throw new HTTPException(404, { message: "Not found" });
  await next();
});

const catchUpRoutes = router
  .openapi(catchUpRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { hours } = c.req.valid("json");
    return c.json(await catchUp(await readerOf(c, workspaceId), hours), 200);
  })
  .openapi(getPreferenceRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(
      await getCatchUpPreference({ workspaceId, userId: c.get("userId") }),
      200,
    );
  })
  .openapi(setPreferenceRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { includeDirectMessages } = c.req.valid("json");
    return c.json(
      await setCatchUpPreference(
        { workspaceId, userId: c.get("userId") },
        includeDirectMessages,
      ),
      200,
    );
  });

export default catchUpRoutes;
