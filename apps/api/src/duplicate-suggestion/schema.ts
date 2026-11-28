import { z } from "../openapi";

export const duplicateTaskParam = z.object({ taskId: z.string().min(1) });

export const declineDuplicateBody = z.object({
  otherTaskId: z.string().min(1).openapi({
    description: "The suggested ticket that is not a duplicate of this one.",
  }),
});

export const duplicateSuggestionsSchema = z
  .object({
    suggestions: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          ticket: z.string().openapi({ example: "WEB-12" }),
          projectId: z.string(),
          status: z.string(),
          similarity: z.number(),
        })
        .openapi("DuplicateSuggestion"),
    ),
  })
  .openapi("DuplicateSuggestions");

export const declinedDuplicateSchema = z
  .object({ declined: z.literal(true) })
  .openapi("DeclinedDuplicate");
