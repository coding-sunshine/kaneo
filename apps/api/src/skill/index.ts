import { HTTPException } from "hono/http-exception";
import { readerOf } from "../agent/cite-messages";
import { isAgentEnabled } from "../agent/openrouter";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { listSkillRuns } from "./list-runs";
import { prepareSkillRun, runSkill } from "./run-skill";
import { streamSkillRun } from "./stream-skill-run";
import {
  createdSkillSchema,
  createSkillBody,
  deletedSkillSchema,
  runSkillBody,
  skillListSchema,
  skillParam,
  skillRunListSchema,
  skillRunResultSchema,
  workspaceParam,
} from "./schema";
import { createSkill, deleteSkill, listSkills } from "./skill-store";

const tags = ["AI skills"];
// Skills are personal and read through the caller's own access, so reading
// tickets is the permission they need.
const middleware = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"], task: ["read"] }),
] as const;
const json = <T>(schema: T) => ({
  content: { "application/json": { schema } },
  required: true,
});
const common = {
  403: errorResponse("Missing project:read or task:read permission"),
  404: errorResponse("AI is off, or the skill or workspace was not found"),
};

const listRoute = createRoute({
  method: "get",
  operationId: "listAiSkills",
  path: "/workspace/{workspaceId}/skills",
  tags,
  summary: "List my skills",
  description: "Your saved AI skills in a workspace. Nobody else sees them.",
  middleware: [...middleware] as const,
  request: { params: workspaceParam },
  responses: { 200: jsonResponse("Skills", skillListSchema), ...common },
});

const createSkillRoute = createRoute({
  method: "post",
  operationId: "createAiSkill",
  path: "/workspace/{workspaceId}/skills",
  tags,
  summary: "Save a skill",
  description:
    "Saves a prompt you run with /<name> in chat. Scope it to projects you can open, and cap its tokens per month.",
  middleware: [...middleware] as const,
  request: { params: workspaceParam, body: json(createSkillBody) },
  responses: {
    200: jsonResponse("Saved skill", createdSkillSchema),
    400: errorResponse("Invalid name or prompt"),
    409: errorResponse("You already have a skill with this name"),
    ...common,
  },
});

const deleteRoute = createRoute({
  method: "delete",
  operationId: "deleteAiSkill",
  path: "/workspace/{workspaceId}/skills/{skillId}",
  tags,
  summary: "Delete a skill",
  description: "Deletes one of your skills and its run history.",
  middleware: [...middleware] as const,
  request: { params: skillParam },
  responses: { 200: jsonResponse("Deleted", deletedSkillSchema), ...common },
});

const runRoute = createRoute({
  method: "post",
  operationId: "runAiSkill",
  path: "/workspace/{workspaceId}/skills/{skillId}/run",
  tags,
  summary: "Run a skill",
  description:
    "Runs your skill from a channel you can read, over the open tickets and comments it may read, and answers with cited bullets for you only. Nothing is posted. Answers 429 when the skill's monthly credit cap or an AI budget is used up.",
  middleware: [...middleware] as const,
  request: { params: skillParam, body: json(runSkillBody) },
  responses: {
    200: jsonResponse("The skill's answer", skillRunResultSchema),
    429: errorResponse("Credit cap or AI budget used up"),
    502: errorResponse("The model's answer could not be read"),
    ...common,
  },
});

const runStreamRoute = createRoute({
  method: "post",
  operationId: "streamAiSkillRun",
  path: "/workspace/{workspaceId}/skills/{skillId}/run/stream",
  tags,
  summary: "Run a skill and stream the answer",
  description:
    "Same as running a skill, for runs that take long: the checks answer at once with their status, then server-sent events follow: `ping` every 15 seconds while the model works, then `result` with the same answer as the plain route, or `error` with `status` and `message` (429 when a cap or budget is used up, 502 when the answer could not be read).",
  middleware: [...middleware] as const,
  request: { params: skillParam, body: json(runSkillBody) },
  responses: {
    200: {
      description: "Server-sent event stream",
      content: { "text/event-stream": { schema: z.string() } },
    },
    429: errorResponse("Credit cap or AI budget used up"),
    ...common,
  },
});

const runsRoute = createRoute({
  method: "get",
  operationId: "listAiSkillRuns",
  path: "/workspace/{workspaceId}/runs",
  tags,
  summary: "List my skill runs",
  description: "Your latest skill runs with their tokens, newest first.",
  middleware: [...middleware] as const,
  request: { params: workspaceParam },
  responses: { 200: jsonResponse("Runs", skillRunListSchema), ...common },
});

const skill = apiRouter();
skill.use("*", async (_c, next) => {
  if (!isAgentEnabled()) throw new HTTPException(404, { message: "Not found" });
  await next();
});

const routes = skill
  .openapi(listRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(
      await listSkills({ workspaceId, userId: c.get("userId") }),
      200,
    );
  })
  .openapi(createSkillRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(
      await createSkill(
        { workspaceId, userId: c.get("userId") },
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { workspaceId, skillId } = c.req.valid("param");
    return c.json(
      await deleteSkill({ workspaceId, userId: c.get("userId") }, skillId),
      200,
    );
  })
  .openapi(runRoute, async (c) => {
    const { workspaceId, skillId } = c.req.valid("param");
    const { channelId, input } = c.req.valid("json");
    return c.json(
      await runSkill(await readerOf(c, workspaceId), skillId, channelId, input),
      200,
    );
  })
  .openapi(runStreamRoute, async (c) => {
    const { workspaceId, skillId } = c.req.valid("param");
    const { channelId, input } = c.req.valid("json");
    const run = await prepareSkillRun(
      await readerOf(c, workspaceId),
      skillId,
      channelId,
      input,
    );
    return streamSkillRun(c, run) as never;
  })
  .openapi(runsRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(
      await listSkillRuns({ workspaceId, userId: c.get("userId") }),
      200,
    );
  });

export default routes;
