import { nullableResponseTimestamp, z } from "../../openapi";
import { AI_PROVIDERS } from "./endpoint";

const providerSchema = z.enum(AI_PROVIDERS).openapi({
  description:
    "`openrouter` sends the workspace's text to OpenRouter; `self-hosted` sends it only to the model server this instance's owner configured.",
});

export const aiDestinationSchema = z
  .object({
    provider: providerSchema,
    model: z.string().nullable().openapi({
      description: "The model that receives the text.",
    }),
    host: z.string().nullable().openapi({
      description: "The OpenRouter host the model is pinned to, if any.",
    }),
    openRouter: z.object({ configured: z.boolean() }),
    selfHosted: z.object({ configured: z.boolean() }).openapi({
      description:
        "Whether the server has a self-hosted model URL (`AI_SELF_HOSTED_URL`).",
    }),
    canChange: z.boolean().openapi({
      description: "Whether you may change the destination (admins only).",
    }),
    changedAt: nullableResponseTimestamp,
    changedBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  })
  .openapi("AiDestination");

export const setAiDestinationBody = z
  .discriminatedUnion("provider", [
    z.object({ provider: z.literal("openrouter") }),
    z.object({
      provider: z.literal("self-hosted"),
      model: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .regex(/^[\w.:/@-]+$/, "Use letters, digits and . : / @ - _ only")
        .openapi({ description: "The self-hosted model's name." }),
    }),
  ])
  .openapi("SetAiDestination");
