import { z } from "../../openapi";

export const teamParam = z.object({
  workspaceId: z.string(),
  projectId: z.string().openapi({ description: "The team's id." }),
});

export const triageSettingsSchema = z
  .object({
    guidance: z.string().max(4_000).openapi({
      description:
        "Sent to the model with every new triage ticket of the team, such as which labels or people handle what.",
    }),
    autoApply: z.boolean().openapi({
      description:
        "Apply the suggestion without anyone accepting it. Off by default.",
    }),
  })
  .openapi("AiTriageSettings");
