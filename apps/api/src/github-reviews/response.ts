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
  /** Set once merged or closed. */
  closedAt: z.string().nullable(),
});

const mergeStates = [
  "ready",
  "blocked",
  "behind",
  "queued",
  "unstable",
  "draft",
  "unknown",
] as const;

const linkedIssue = z.object({
  taskId: z.string(),
  workspaceId: z.string(),
  linkId: z.string(),
  /** Only manual links can be removed through the external link API. */
  manual: z.boolean(),
  title: z.string(),
  priority: z.string(),
  /** Linear's team is a Kaneo project. */
  team: z.object({ id: z.string(), name: z.string() }),
  /** Linear's project is a Kaneo work project. */
  project: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export const reviewListItemSchema = pullRequestSummarySchema.extend({
  reviewDecision: z
    .enum(["approved", "changes_requested", "review_required"])
    .nullable(),
  checks: z.enum(["success", "failure", "pending", "none"]),
  additions: z.number(),
  deletions: z.number(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  /** Requested and already-reviewed people. */
  reviewers: z.array(person),
  /** Slugs of requested teams. */
  teamReviewers: z.array(z.string()),
  approvedBy: z.array(z.string()),
  changesRequestedBy: z.array(z.string()),
  hasConflicts: z.boolean(),
  mergeState: z.enum(mergeStates),
  /** Review requested through a team only, not from you directly. */
  teamRequested: z.boolean(),
  issue: linkedIssue.nullable(),
});

export const reviewListSchema = z.object({
  toReview: z.array(reviewListItemSchema),
  created: z.array(reviewListItemSchema),
  participated: z.array(reviewListItemSchema),
});

export const pullRequestSchema = pullRequestSummarySchema.extend({
  body: z.string(),
  mergeable: z.boolean().nullable(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  headSha: z.string(),
  headRef: z.string(),
  baseRef: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changedFiles: z.number(),
  /** Reviews still requested; people who already reviewed are in the conversation. */
  requestedReviewers: z.array(person),
  issue: linkedIssue.nullable(),
});

export const reviewerCandidatesSchema = z.array(person);
export const readySchema = z.object({ ok: z.literal(true) });

export const filesSchema = z.array(
  z.object({
    filename: z.string(),
    status: z.string(),
    additions: z.number(),
    deletions: z.number(),
    patch: z.string().nullable(),
  }),
);

export const commitsSchema = z.array(
  z.object({
    sha: z.string(),
    title: z.string(),
    date: z.string().nullable(),
    /** First parent; the base of a diff that starts at this commit. */
    parent: z.string().nullable(),
  }),
);

export const fileContentSchema = z.object({
  /** Null for binary, oversized or non-file paths. */
  content: z.string().nullable(),
});

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
    kind: z.enum(["comment", "review", "review_comment"]),
    author: person.nullable(),
    body: z.string(),
    reviewState: z.string().nullable(),
    // Only inline review comments carry a position; line is null once outdated.
    path: z.string().nullable(),
    line: z.number().nullable(),
    side: z.enum(["LEFT", "RIGHT"]).nullable(),
    createdAt: z.string(),
  }),
);

export const reviewSubmittedSchema = z.object({ ok: z.literal(true) });
export const mergedSchema = z.object({ ok: z.literal(true) });
export const disconnectedSchema = z.object({ ok: z.literal(true) });
