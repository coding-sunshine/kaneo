import { z } from "../openapi";

export const standupParam = z.object({ workspaceId: z.string().min(1) });

export const standupQuery = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((days) => days === 1 || days === 7, "days must be 1 or 7")
    .default(1)
    .openapi({
      description:
        "1 for a daily standup, 7 for a weekly reflection: how far back completed tickets are listed.",
    }),
});

const standupItem = z
  .object({
    id: z.string(),
    title: z.string(),
    ticket: z.string().openapi({ example: "WEB-12" }),
    projectId: z.string(),
  })
  .openapi("StandupItem");

export const standupDraftSchema = z
  .object({
    did: z.array(standupItem),
    doing: z.array(standupItem),
    blocked: z.array(standupItem),
  })
  .openapi("StandupDraft");
