import { z } from "../openapi";
import { SOURCE_KINDS } from "./sources";

export const citationSchema = z
  .union([
    z.object({
      kind: z.enum(SOURCE_KINDS),
      restricted: z.literal(false),
      id: z.string(),
      title: z.string(),
      taskId: z.string().optional().openapi({
        description: "The issue a task or a comment is on.",
      }),
      projectId: z.string().optional(),
      ticket: z.string().optional(),
    }),
    z.object({
      kind: z.enum(SOURCE_KINDS),
      restricted: z.literal(true),
    }),
  ])
  .openapi("AgentCitation", {
    description:
      "A source an answer rests on. One the reader cannot open, or that is gone, is only `restricted`, with no title or id.",
  });
