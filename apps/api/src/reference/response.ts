import { z } from "../openapi";
import { REFERENCE_PLACES } from "../database/schema";

const referenceSchema = z
  .object({
    kind: z.enum(["task", "document"]).openapi({
      description: "Whether the source is a task or a document.",
    }),
    id: z.string(),
    title: z.string(),
    key: z.string().nullable().openapi({
      description: "A task's key, such as ENG-12. Null for a document.",
    }),
    places: z.array(z.enum(REFERENCE_PLACES)).openapi({
      description:
        "Where the source names the target: a task's `description` or `comment`, or a document's text (`document`).",
    }),
  })
  .openapi("Reference");

export const referenceListSchema = z
  .object({ references: z.array(referenceSchema) })
  .openapi("ReferenceList");
