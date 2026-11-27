import { z } from "../openapi";

const tokenBudget = z
  .number()
  .int()
  .min(0)
  .max(1_000_000_000)
  .nullable()
  .openapi({ description: "Tokens. Null means no limit; 0 stops every call." });

export const aiBudgetSchema = z
  .object({
    userDailyTokens: tokenBudget.openapi({
      description:
        "Tokens one person may use in this workspace per UTC day. Null means no limit.",
    }),
    workspaceMonthlyTokens: tokenBudget.openapi({
      description:
        "Tokens the whole workspace may use per UTC calendar month. Null means no limit.",
    }),
  })
  .openapi("AiBudget");

export const aiUsageSchema = z
  .object({
    budget: aiBudgetSchema,
    monthTokens: z
      .number()
      .int()
      .openapi({ description: "Tokens used this UTC month." }),
    days: z
      .number()
      .int()
      .openapi({ description: "How many days the lists below cover." }),
    byFeature: z.array(
      z.object({
        feature: z.string().openapi({
          description: "assistant, loop or loop-draft.",
        }),
        tokens: z.number().int(),
        cost: z.number().nullable().openapi({
          description: "US dollars the provider reported, when it did.",
        }),
      }),
    ),
    byDay: z.array(
      z.object({
        day: z.string().openapi({ description: "UTC date, YYYY-MM-DD." }),
        tokens: z.number().int(),
      }),
    ),
  })
  .openapi("AiUsage");
