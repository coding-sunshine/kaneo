import { z } from "../openapi";

export const connectQuery = z.object({
  returnTo: z.string().optional().openapi({
    description: "App-relative path to return to after connecting.",
  }),
});

export const callbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const closedWindows = ["all", "day", "week", "month", "none"] as const;

export const listQuery = z.object({
  closed: z.enum(closedWindows).default("week").openapi({
    description:
      "How far back to include merged and closed pull requests you created or took part in. Drafts are always included.",
  }),
});

const githubName = z.string().regex(/^[\w.-]+$/);
export const pullParams = z.object({
  owner: githubName,
  repo: githubName,
  number: z.string().regex(/^\d+$/),
});

export const reviewBody = z
  .object({
    event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
    body: z.string().max(65536).default(""),
  })
  .refine((value) => value.event === "APPROVE" || value.body.trim() !== "", {
    message: "A comment is required unless you approve",
    path: ["body"],
  });

export const commentBody = z.object({
  body: z.string().trim().min(1).max(65536),
});

export const mergeBody = z.object({
  mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge"),
});

export const reviewersBody = z.object({
  reviewers: z.array(githubName).min(1).max(15),
});
