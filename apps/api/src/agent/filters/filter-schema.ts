import { z } from "../../openapi";

export const parseFilterBody = z
  .object({
    projectId: z.string().min(1).openapi({
      description: "The team whose board the filter is for.",
    }),
    text: z.string().trim().min(1).max(500).openapi({
      description:
        "The filter in plain English, e.g. 'my blocked bugs older than 2 weeks'.",
    }),
  })
  .openapi("ParseFilterRequest");

export const parsedFilterSchema = z
  .object({
    filters: z
      .object({
        assignee: z.array(z.string()).optional().openapi({
          description: "User ids.",
        }),
        labels: z.array(z.string()).optional().openapi({
          description: "Label ids.",
        }),
        status: z.array(z.string()).optional().openapi({
          description: "Status slugs of the team's columns.",
        }),
        priority: z.array(z.string()).optional(),
        blocked: z.literal(true).optional().openapi({
          description: "Only tickets blocked by an open blocking relation.",
        }),
        createdAt: z.array(z.string()).optional().openapi({
          description:
            "`olderThan:<days>`: created more than that many days ago.",
        }),
      })
      .nullable()
      .openapi({
        description: "The board filter, or null when a question comes back.",
      }),
    question: z.string().nullable().openapi({
      description:
        "One question back when the sentence was unclear; nothing is applied.",
    }),
  })
  .openapi("ParsedFilter");
