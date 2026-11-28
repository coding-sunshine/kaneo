import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { openBrief } from "./open-brief";
import { getBriefPreference, setBriefPreference } from "./preference";
import {
  briefParam,
  briefPreferenceSchema,
  briefSchema,
  workspaceParam,
} from "./schema";

const tags = ["Daily brief"];
const own = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ workspace: ["read"] }),
] as const;
const missing = { 404: errorResponse("Not found") };

const getPreferenceRoute = createRoute({
  method: "get",
  operationId: "getDailyBriefPreference",
  path: "/workspace/{workspaceId}/preference",
  tags,
  summary: "My daily brief setting",
  description: "Whether your morning brief is on, and the channels it reads.",
  middleware: [...own] as const,
  request: { params: workspaceParam },
  responses: {
    200: jsonResponse("Setting", briefPreferenceSchema),
    ...missing,
  },
});

const setPreferenceRoute = createRoute({
  method: "put",
  operationId: "setDailyBriefPreference",
  path: "/workspace/{workspaceId}/preference",
  tags,
  summary: "Set my daily brief",
  description:
    "Turns your morning brief on or off and picks the channels it reads. Each must be a channel you can read; direct messages and channels marked no AI are never read.",
  middleware: [...own] as const,
  request: {
    params: workspaceParam,
    body: {
      content: { "application/json": { schema: briefPreferenceSchema } },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Saved", briefPreferenceSchema),
    400: errorResponse("A direct message or a channel marked no AI was chosen"),
    ...missing,
  },
});

const getBriefRoute = createRoute({
  method: "get",
  operationId: "getDailyBrief",
  path: "/workspace/{workspaceId}/briefs/{briefId}",
  tags,
  summary: "Open my brief",
  description:
    "Your brief for one morning: tickets due that day, mentions in your chosen channels and your tickets someone moved. Only you can open it.",
  middleware: [...own] as const,
  request: { params: briefParam },
  responses: { 200: jsonResponse("Brief", briefSchema), ...missing },
});

const dailyBrief = apiRouter()
  .openapi(getPreferenceRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getBriefPreference(workspaceId, c.get("userId")), 200);
  })
  .openapi(setPreferenceRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { enabled, channelIds } = c.req.valid("json");
    return c.json(
      await setBriefPreference(
        workspaceId,
        c.get("userId"),
        enabled,
        channelIds,
      ),
      200,
    );
  })
  .openapi(getBriefRoute, async (c) => {
    const { workspaceId, briefId } = c.req.valid("param");
    return c.json(await openBrief(workspaceId, c.get("userId"), briefId), 200);
  });

export default dailyBrief;
