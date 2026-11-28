import { z } from "zod";

const update = z.string().min(1).max(2_000_000).openapi({
  description: "A Yjs update, base64.",
});

export const collabStateSchema = z
  .object({
    state: z.string().nullable().openapi({
      description:
        "The merged Yjs state, base64. Null when the document has none for its current text: seed it from `content`.",
    }),
    contentHash: z.string().openapi({
      description: "The `contentHash` of the document's current text.",
    }),
    content: z.string().nullable().openapi({
      description: "The current text to seed from, when `state` is null.",
    }),
  })
  .openapi("DocumentCollabState");

export const collabSeedBody = z.object({
  update,
  baseHash: z.string().max(128).openapi({
    description: "The `contentHash` of the text the state was made from.",
  }),
});

export const collabUpdateBody = z.object({ update });

export const collabTextBody = z.object({
  content: z.string().max(1_000_000),
  baseHash: z.string().max(128).optional().openapi({
    description:
      "Only after reviewing a newer text someone saved outside co-editing: its `contentHash`, to save over it.",
  }),
});

export const collabAppliedSchema = z
  .object({ applied: z.boolean() })
  .openapi("DocumentCollabApplied");
