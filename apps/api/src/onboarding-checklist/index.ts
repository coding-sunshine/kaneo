import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { dismissChecklist } from "./controllers/dismiss-checklist";
import { getChecklist } from "./controllers/get-checklist";
import { markChecklistItem } from "./controllers/mark-checklist-item";
import { seedWelcomeWorkspace } from "./controllers/seed-welcome-workspace";
import {
  checklistItemParam,
  checklistSchema,
  dismissedSchema,
  welcomeWorkspaceSchema,
} from "./schema";

const tags = ["Onboarding"];
const unauthorized = errorResponse("Unauthorized");
const apiKey = errorResponse("Authenticated with an API key");

const welcomeWorkspaceRoute = createRoute({
  method: "post",
  operationId: "createWelcomeWorkspace",
  path: "/welcome-workspace",
  tags,
  summary: "Make your welcome workspace",
  description:
    "Make the welcome workspace, with a Handbook page, a #welcome channel and a sample ticket, and open your onboarding checklist. Only for people who signed up with the checklist, have no workspace and no pending invitation, and may create workspaces; anyone else gets null. Runs once.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("The welcome workspace, or null", welcomeWorkspaceSchema),
    401: unauthorized,
    403: apiKey,
  },
});

const getChecklistRoute = createRoute({
  method: "get",
  operationId: "getOnboardingChecklist",
  path: "/checklist",
  tags,
  summary: "Get your onboarding checklist",
  description:
    "Return the new-hire checklist made at sign-up, with links into your welcome workspace. Only ever your own. Requires a user session; API keys are rejected.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Your checklist, or null", checklistSchema),
    401: unauthorized,
    403: apiKey,
  },
});

const completeItemRoute = createRoute({
  method: "post",
  operationId: "completeOnboardingChecklistItem",
  path: "/checklist/items/{itemId}/complete",
  tags,
  summary: "Tick a checklist item",
  description:
    "Mark an item of your open checklist done. Ticking a done item changes nothing.",
  middleware: [requireUserSession] as const,
  request: { params: checklistItemParam },
  responses: {
    200: jsonResponse("Your checklist", checklistSchema),
    400: errorResponse("Unknown item, or one ticked by doing it"),
    401: unauthorized,
    403: apiKey,
    404: errorResponse("You have no open checklist"),
  },
});

const dismissRoute = createRoute({
  method: "post",
  operationId: "dismissOnboardingChecklist",
  path: "/checklist/dismiss",
  tags,
  summary: "Dismiss your onboarding checklist",
  description: "Hide your checklist for good.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("Dismissed", dismissedSchema),
    401: unauthorized,
    403: apiKey,
    404: errorResponse("You have no open checklist"),
  },
});

const onboarding = apiRouter()
  .openapi(welcomeWorkspaceRoute, async (c) => {
    const workspaceId = await seedWelcomeWorkspace(
      { id: c.get("userId"), email: c.get("userEmail") },
      (body) => auth.api.createOrganization({ body }),
    );
    return c.json({ workspaceId }, 200);
  })
  .openapi(getChecklistRoute, async (c) =>
    c.json(await getChecklist(c.get("userId")), 200),
  )
  .openapi(completeItemRoute, async (c) => {
    const userId = c.get("userId");
    if (!(await markChecklistItem(userId, c.req.valid("param").itemId)))
      throw new HTTPException(404, { message: "No open checklist" });
    return c.json(await getChecklist(userId), 200);
  })
  .openapi(dismissRoute, async (c) =>
    c.json(await dismissChecklist(c.get("userId")), 200),
  );

export default onboarding;
