import { z } from "../openapi";
import { REFERENCE_PLACES } from "../database/schema";

const referenceSchema = z
  .object({
    kind: z.enum(["task", "document", "message"]).openapi({
      description:
        "Whether the source is a task, a document or a chat message.",
    }),
    id: z.string(),
    title: z.string().openapi({
      description:
        "A task's or document's title; a chat message's channel name, empty for a direct message.",
    }),
    key: z.string().nullable().openapi({
      description: "A task's key, such as ENG-12. Null for a document.",
    }),
    projectId: z.string().nullable().openapi({
      description: "The team a task belongs to. Null for a document.",
    }),
    channelId: z.string().optional().openapi({
      description:
        "The channel of a chat message. Absent for a task or a document.",
    }),
    places: z.array(z.enum([...REFERENCE_PLACES, "chat"])).openapi({
      description:
        "Where the source names the target: a task's `description` or `comment`, or a document's text (`document`), or a chat message (`chat`).",
    }),
  })
  .openapi("Reference");

export const referenceListSchema = z
  .object({ references: z.array(referenceSchema) })
  .openapi("ReferenceList");
