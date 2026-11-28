import { citationSchema } from "../agent/citation-schema";
import { z } from "../openapi";

export const workspaceParam = z.object({ workspaceId: z.string().min(1) });

export const catchUpBody = z.object({
  hours: z.number().int().min(1).max(168).default(24).openapi({
    description: "How far back to look, in hours (at most a week).",
  }),
});

export const messageCitationSchema = z
  .object({
    kind: z.literal("message"),
    restricted: z.literal(false),
    id: z
      .string()
      .openapi({ description: "The message, or the thread a reply is in." }),
    channelId: z.string(),
    channelName: z.string(),
  })
  .openapi("MessageCitation");

export const catchUpSchema = z
  .object({
    bullets: z.array(
      z.object({
        text: z.string(),
        sources: z.array(z.union([messageCitationSchema, citationSchema])),
      }),
    ),
  })
  .openapi("CatchUp");

export const catchUpPreferenceSchema = z
  .object({
    includeDirectMessages: z.boolean().openapi({
      description:
        "Let AI answers for you read your direct messages: catch-up and the assistant's search. Direct messages marked no AI stay out. Off by default.",
    }),
  })
  .openapi("CatchUpPreference");
