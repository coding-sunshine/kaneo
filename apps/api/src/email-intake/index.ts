import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  emailIntakeSchema,
  emailReplyBody,
  emailReplySchema,
  emailThreadSchema,
  projectIdParam,
  taskIdParam,
} from "./schema";
import { getTicketThread, sendTicketReply } from "./send-ticket-reply";
import {
  disableTeamIntake,
  enableTeamIntake,
  getTeamIntake,
} from "./team-intake";

const tags = ["Email intake"];
const noTeamAccess = errorResponse("Missing permission for this team");

const getRoute = createRoute({
  method: "get",
  operationId: "getEmailIntake",
  path: "/project/{projectId}",
  tags,
  summary: "Get a team's email intake",
  description:
    "Whether the instance has an intake mailbox and the team's intake address. Mail to the address becomes a Triage ticket, so the address is shown only to people who can change the team.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The team's email intake", emailIntakeSchema),
    403: noTeamAccess,
  },
});

const enableRoute = createRoute({
  method: "put",
  operationId: "enableEmailIntake",
  path: "/project/{projectId}",
  tags,
  summary: "Turn on a team's email intake",
  description:
    "Give the team an intake address and a Triage status. Running it again keeps the current address.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The team's email intake", emailIntakeSchema),
    403: noTeamAccess,
    404: errorResponse("Team not found"),
    409: errorResponse("This instance has no intake mailbox"),
  },
});

const disableRoute = createRoute({
  method: "delete",
  operationId: "disableEmailIntake",
  path: "/project/{projectId}",
  tags,
  summary: "Turn off a team's email intake",
  description:
    "Stop filing mail sent to the team's address. Existing tickets keep their email history.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The team's email intake", emailIntakeSchema),
    403: noTeamAccess,
  },
});

const threadRoute = createRoute({
  method: "get",
  operationId: "getTicketEmailThread",
  path: "/task/{taskId}",
  tags,
  summary: "Get a ticket's email requester",
  description:
    "Who emailed the ticket in and its subject, or null when the ticket did not come in by email.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("The ticket's email requester", emailThreadSchema),
    403: errorResponse("Missing permission for this task"),
  },
});

const replyRoute = createRoute({
  method: "post",
  operationId: "replyToTicketByEmail",
  path: "/task/{taskId}/reply",
  tags,
  summary: "Reply to a ticket's requester by email",
  description:
    "Email the text to the requester in their thread, with the team's intake address as Reply-To, and add it to the ticket as your comment.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: emailReplyBody } },
    },
  },
  responses: {
    200: jsonResponse("The reply was sent", emailReplySchema),
    403: errorResponse("Missing permission for this task"),
    404: errorResponse("The ticket did not come in by email"),
    409: errorResponse("Email intake or SMTP is off"),
    502: errorResponse("The mail server rejected the reply"),
  },
});

const emailIntake = apiRouter()
  .openapi(getRoute, async (c) =>
    c.json(await getTeamIntake(c.req.valid("param").projectId), 200),
  )
  .openapi(enableRoute, async (c) =>
    c.json(await enableTeamIntake(c.req.valid("param").projectId), 200),
  )
  .openapi(disableRoute, async (c) =>
    c.json(await disableTeamIntake(c.req.valid("param").projectId), 200),
  )
  .openapi(threadRoute, async (c) => {
    const thread = await getTicketThread(c.req.valid("param").taskId);
    return c.json(
      thread
        ? {
            address: thread.requester.address,
            name: thread.requester.name,
            subject: thread.requester.subject,
          }
        : null,
      200,
    );
  })
  .openapi(replyRoute, async (c) =>
    c.json(
      await sendTicketReply(
        c.req.valid("param").taskId,
        c.get("userId"),
        c.req.valid("json").content,
      ),
      200,
    ),
  );

export default emailIntake;
