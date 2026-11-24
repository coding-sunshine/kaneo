import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const searchResultSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      "task",
      "project",
      "workspace",
      "comment",
      "activity",
      "document",
    ]),
    title: z.string(),
    description: z.string().optional(),
    content: z.string().optional().openapi({
      description:
        "Matched body text, for comment and activity results. Activities get a rendered summary such as `changed status from Todo to In Progress`.",
    }),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    projectSlug: z.string().optional(),
    workspaceId: z.string().optional(),
    workspaceName: z.string().optional(),
    userId: z.string().optional(),
    userName: z.string().optional(),
    createdAt: responseTimestamp,
    relevanceScore: z.number().openapi({
      description:
        "Higher is a better match. Results are sorted by score, then by createdAt descending. Among documents, current ones come first.",
    }),
    taskId: z
      .string()
      .optional()
      .openapi({ description: "The task a comment or activity belongs to." }),
    taskNumber: z.number().optional(),
    priority: z.string().optional(),
    status: z.string().optional().openapi({
      description:
        "A task's column, or where a document stands: `draft`, `in_review`, `current` or `superseded`.",
    }),
    archivedAt: nullableResponseTimestamp.optional(),
  })
  .openapi("SearchResult");

export const searchResponseSchema = z
  .object({
    results: z.array(searchResultSchema),
    totalCount: z.number().openapi({
      description:
        "Total matches found before the `limit` slice, so a caller can tell that more exist.",
    }),
    searchQuery: z.string().openapi({ description: "The query that was run." }),
  })
  .openapi("SearchResponse");
