import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
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
import { acceptNotes } from "./accept-notes";
import { latestKeptRun } from "./notes-store";
import { proposeNotes } from "./propose-notes";
import {
  acceptedNotesSchema,
  acceptNotesBody,
  documentParam,
  latestRunSchema,
  proposalSchema,
  proposeNotesBody,
  transcriptSchema,
  workspaceParam,
} from "./schema";
import {
  isSpeechToTextEnabled,
  MAX_AUDIO_BYTES,
  SPEECH_TO_TEXT_OFF,
  transcribe,
} from "./transcribe";

const tags = ["Meeting notes"];
const read = [
  workspaceAccess.fromParam(),
  requireWorkspacePermission({ project: ["read"], task: ["read"] }),
] as const;
const json = <T>(schema: T) => ({
  content: { "application/json": { schema } },
  required: true,
});
const common = {
  403: errorResponse("Missing permission"),
  404: errorResponse("AI is off, or the document was not found"),
};
const path = "/workspace/{workspaceId}/documents/{documentId}";

const proposeRoute = createRoute({
  method: "post",
  operationId: "proposeMeetingNotes",
  path: `${path}/notes`,
  tags,
  summary: "Propose notes from a transcript",
  description:
    "Reads a meeting transcript and proposes decisions and tickets, each with the quote it came from. Nothing is created until you accept. With keep false the transcript and proposal are not stored.",
  middleware: [...read] as const,
  request: { params: documentParam, body: json(proposeNotesBody) },
  responses: {
    200: jsonResponse("Proposal", proposalSchema),
    429: errorResponse("AI budget used up"),
    502: errorResponse("The model's answer could not be read"),
    ...common,
  },
});

const latestRoute = createRoute({
  method: "get",
  operationId: "getMeetingNotes",
  path: `${path}/notes`,
  tags,
  summary: "My latest kept notes",
  description: "Your latest kept proposal on this document, or null.",
  middleware: [...read] as const,
  request: { params: documentParam },
  responses: {
    200: jsonResponse("Latest kept run", latestRunSchema),
    ...common,
  },
});

const acceptRoute = createRoute({
  method: "post",
  operationId: "acceptMeetingNotes",
  path: `${path}/accept`,
  tags,
  summary: "Create the accepted tickets",
  description:
    "Creates the action items you accepted as tickets in a team you can open.",
  middleware: [
    workspaceAccess.fromParam(),
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: { params: documentParam, body: json(acceptNotesBody) },
  responses: {
    200: jsonResponse("Created tickets", acceptedNotesSchema),
    ...common,
  },
});

const transcribeRoute = createRoute({
  method: "post",
  operationId: "transcribeMeeting",
  path: "/workspace/{workspaceId}/transcribe",
  tags,
  summary: "Transcribe a recording",
  description:
    "Turns a meeting recording (up to 25 MB) into text with the server's speech-to-text service. The audio is not stored. Off until the server has STT_API_KEY.",
  middleware: [
    // Refused from the declared size, or once a body without one passes
    // the limit, before anything is buffered. Room for the form's framing.
    bodyLimit({
      maxSize: MAX_AUDIO_BYTES + 64 * 1024,
      onError: () => {
        throw new HTTPException(413, {
          message: "The recording is over 25 MB.",
        });
      },
    }),
    ...read,
  ] as const,
  request: {
    params: workspaceParam,
    body: {
      content: {
        "multipart/form-data": { schema: z.object({ file: z.any() }) },
      },
      required: true,
    },
  },
  responses: {
    200: jsonResponse("Transcript", transcriptSchema),
    413: errorResponse("Recording too large"),
    502: errorResponse("Speech to text failed"),
    ...common,
  },
});

const router = apiRouter();
router.use("*", async (_c, next) => {
  if (!isAgentEnabled()) throw new HTTPException(404, { message: "Not found" });
  await next();
});

const meetingNotes = router
  .openapi(proposeRoute, async (c) => {
    const { workspaceId, documentId } = c.req.valid("param");
    const { transcript, keep } = c.req.valid("json");
    return c.json(
      await proposeNotes(
        workspaceId,
        documentId,
        c.get("userId"),
        transcript,
        keep,
      ),
      200,
    );
  })
  .openapi(latestRoute, async (c) => {
    const { workspaceId, documentId } = c.req.valid("param");
    return c.json(
      await latestKeptRun(workspaceId, documentId, c.get("userId")),
      200,
    );
  })
  .openapi(acceptRoute, async (c) => {
    const { workspaceId, documentId } = c.req.valid("param");
    const { projectId, items } = c.req.valid("json");
    return c.json(
      await acceptNotes(
        workspaceId,
        documentId,
        c.get("userId"),
        projectId,
        items,
      ),
      200,
    );
  })
  .openapi(transcribeRoute, async (c) => {
    if (!isSpeechToTextEnabled())
      throw new HTTPException(404, { message: SPEECH_TO_TEXT_OFF });
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File))
      throw new HTTPException(400, { message: "Attach the recording as file" });
    return c.json(await transcribe(file), 200);
  });

export default meetingNotes;
