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

export const listQuery = z.object({
  includeDrafts: z.enum(["true", "false"]).default("false"),
  includeClosed: z.enum(["true", "false"]).default("false"),
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
