import { z } from "../openapi";

export const workspaceParam = z.object({ workspaceId: z.string().min(1) });
export const documentParam = workspaceParam.extend({
  documentId: z.string().min(1),
});

export const proposeNotesBody = z.object({
  transcript: z.string().trim().min(20).max(100_000),
  keep: z.boolean().openapi({
    description:
      "Keep the transcript and proposal with the document. False stores neither.",
  }),
});

const decision = z.object({ text: z.string(), quote: z.string() });
const actionItem = z.object({
  title: z.string(),
  description: z.string(),
  quote: z.string(),
});

export const proposalSchema = z
  .object({
    runId: z.string().nullable(),
    decisions: z.array(decision),
    actionItems: z.array(actionItem),
  })
  .openapi("MeetingNotesProposal");

export const latestRunSchema = z
  .object({
    run: z
      .object({
        runId: z.string(),
        decisions: z.array(decision),
        actionItems: z.array(actionItem),
        createdAt: z.string(),
      })
      .nullable(),
  })
  .openapi("MeetingNotesLatestRun");

export const acceptNotesBody = z.object({
  projectId: z.string().min(1),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(4000).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const acceptedNotesSchema = z
  .object({
    tasks: z.array(
      z.object({ id: z.string(), title: z.string(), projectId: z.string() }),
    ),
  })
  .openapi("MeetingNotesAccepted");

export const transcriptSchema = z
  .object({ transcript: z.string() })
  .openapi("MeetingTranscript");
