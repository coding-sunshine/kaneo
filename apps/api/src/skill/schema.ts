import { citationSchema } from "../agent/citation-schema";
import { z } from "../openapi";

export const workspaceParam = z.object({ workspaceId: z.string().min(1) });
export const skillParam = workspaceParam.extend({ skillId: z.string().min(1) });

export const createSkillBody = z.object({
  name: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]{0,31}$/,
      "Use 1-32 lowercase letters, digits or -",
    )
    .openapi({
      description: "What follows the / in chat.",
      example: "blockers",
    }),
  prompt: z.string().trim().min(1).max(4000),
  projectIds: z.array(z.string().min(1)).max(50).nullish().openapi({
    description:
      "Projects the skill reads. Omit or null for every project you can open.",
  }),
  monthlyTokenCap: z.number().int().positive().nullish().openapi({
    description: "Tokens the skill may use per calendar month (UTC).",
  }),
});

const skillSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    prompt: z.string(),
    projectIds: z.array(z.string()).nullable(),
    monthlyTokenCap: z.number().nullable(),
    createdAt: z.string(),
  })
  .openapi("AiSkill");

export const skillListSchema = z
  .object({ skills: z.array(skillSchema) })
  .openapi("AiSkillList");
export const createdSkillSchema = skillSchema;
export const deletedSkillSchema = z
  .object({ deleted: z.literal(true) })
  .openapi("DeletedAiSkill");

export const runSkillBody = z.object({
  channelId: z.string().min(1).openapi({
    description:
      "The channel the skill is run from; you must be able to read it.",
  }),
  input: z.string().max(1000).optional(),
});

export const skillRunResultSchema = z
  .object({
    skillName: z.string(),
    bullets: z.array(
      z.object({ text: z.string(), sources: z.array(citationSchema) }),
    ),
    promptTokens: z.number(),
    completionTokens: z.number(),
  })
  .openapi("AiSkillRunResult");

export const skillRunListSchema = z
  .object({
    runs: z.array(
      z.object({
        id: z.string(),
        skillId: z.string(),
        skillName: z.string(),
        channelId: z.string().nullable(),
        promptTokens: z.number(),
        completionTokens: z.number(),
        createdAt: z.string(),
      }),
    ),
  })
  .openapi("AiSkillRunList");
