import { responseTimestamp, z } from "../../openapi";

export const taskParam = z.object({
  workspaceId: z.string(),
  taskId: z.string(),
});

export const startBody = z.object({ taskId: z.string().min(1) });

export const codingAgentSchema = z
  .object({
    configured: z.boolean().openapi({
      description:
        "False while the server has no coding agent address or key; delegation is then off.",
    }),
    name: z.string().nullable(),
  })
  .openapi("CodingAgent");

export const runSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    agent: z.string(),
    status: z.enum(["starting", "running", "pr_opened", "merged", "failed"]),
    pullRequestUrl: z.string().nullable(),
    error: z.string().nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("CodingAgentRun");

/** What the coding agent reports back about its run. */
export const callbackBody = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started") }),
  z.object({
    type: z.literal("pull_request.opened"),
    pullRequest: z.object({
      url: z
        .string()
        .max(2_000)
        .refine((value) => /^https?:\/\//i.test(value) && URL.canParse(value), {
          message: "A pull request link must be an http(s) address",
        }),
      title: z.string().trim().max(500).optional(),
    }),
  }),
  z.object({ type: z.literal("pull_request.merged") }),
  z.object({
    type: z.literal("failed"),
    message: z.string().max(2_000).optional(),
  }),
]);
