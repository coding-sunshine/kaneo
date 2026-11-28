import { citationSchema } from "../agent/citation-schema";
import { messageCitationSchema } from "../catch-up/schema";
import { z } from "../openapi";

export const workspaceParam = z.object({ workspaceId: z.string().min(1) });
export const semanticSearchBody = z.object({
  query: z.string().trim().min(3).max(500),
});

const sourceSchema = z.union([messageCitationSchema, citationSchema]);

export const semanticSearchSchema = z
  .object({
    answer: z.string().nullable().openapi({
      description:
        "An answer from the matches, or null when there is none or no chat model.",
    }),
    sources: z.array(sourceSchema),
    results: z.array(
      z.object({
        kind: z.enum(["message", "task", "document"]),
        id: z.string(),
        snippet: z.string(),
        citation: sourceSchema,
      }),
    ),
  })
  .openapi("SemanticSearch");
