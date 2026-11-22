import { z } from "../openapi";

export const statusSchema = z.object({
  state: z.enum([
    "not_configured",
    "not_connected",
    "needs_reconnect",
    "connected",
  ]),
  login: z.string().nullable(),
});

const person = z.object({ login: z.string(), avatarUrl: z.string() });

export const pullRequestSummarySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  number: z.number(),
  title: z.string(),
  url: z.string(),
  author: person.nullable(),
  status: z.enum(["draft", "open", "merged", "closed"]),
  comments: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reviewListItemSchema = pullRequestSummarySchema.extend({
  reviewDecision: z
    .enum(["approved", "changes_requested", "review_required"])
    .nullable(),
  checks: z.enum(["success", "failure", "pending", "none"]),
  additions: z.number(),
  deletions: z.number(),
});

export const reviewListSchema = z.object({
  toReview: z.array(reviewListItemSchema),
  created: z.array(reviewListItemSchema),
  participated: z.array(reviewListItemSchema),
});

export const pullRequestSchema = pullRequestSummarySchema.extend({
  body: z.string(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  headSha: z.string(),
  headRef: z.string(),
  baseRef: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
});

export const filesSchema = z.array(
  z.object({
    filename: z.string(),
    status: z.string(),
    additions: z.number(),
    deletions: z.number(),
    patch: z.string().nullable(),
  }),
);

export const checksSchema = z.object({
  state: z.enum(["success", "failure", "pending", "none"]),
  checks: z.array(
    z.object({
      name: z.string(),
      state: z.enum(["success", "failure", "pending"]),
      url: z.string().nullable(),
    }),
  ),
});

export const conversationSchema = z.array(
  z.object({
    id: z.string(),
    kind: z.enum(["comment", "review"]),
    author: person.nullable(),
    body: z.string(),
    reviewState: z.string().nullable(),
    createdAt: z.string(),
  }),
);

export const reviewSubmittedSchema = z.object({ ok: z.literal(true) });
export const disconnectedSchema = z.object({ ok: z.literal(true) });
