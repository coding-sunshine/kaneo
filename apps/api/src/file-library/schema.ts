import { responseTimestamp, z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const listFilesQuery = z.object({
  q: z.string().trim().max(200).optional().openapi({
    description: "Only files whose name contains this text, in any case.",
  }),
});

const sourceSchema = z
  .object({
    kind: z.enum(["ticket", "document", "chat"]),
    id: z.string().openapi({
      description: "The ticket, document or channel the file belongs to.",
    }),
    name: z.string().openapi({
      description:
        "The ticket's or document's title, or the channel's name. Empty for a direct message.",
    }),
    projectId: z.string().nullable().openapi({
      description: "The ticket's team. Null for documents and chat.",
    }),
    number: z.number().nullable().openapi({
      description: "The ticket's number in its team. Null otherwise.",
    }),
    messageId: z.string().nullable().openapi({
      description: "The chat message the file was sent with. Null otherwise.",
    }),
    isDirect: z.boolean().openapi({
      description: "True for a file sent in a direct message.",
    }),
  })
  .openapi("FileLibrarySource");

export const fileListSchema = z.array(
  z
    .object({
      id: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      size: z.number(),
      createdAt: responseTimestamp,
      url: z.string(),
      addedBy: z
        .object({ id: z.string(), name: z.string() })
        .nullable()
        .openapi({
          description:
            "Who uploaded the file. Null once their account is gone.",
        }),
      source: sourceSchema,
    })
    .openapi("FileLibraryItem"),
);
