import type { ToolClient } from "@kaneo/mcp/tools";
import { z } from "zod";
import {
  postProjectUpdate,
  projectUpdateSchema,
} from "../proposals/project-update-tool";

/** The model picks the tickets; the server lays the digest out. */
export const DIGEST_TOOL = "draft_weekly_digest";
/** The laid-out digest a person accepts: posted as a project update. */
export const POST_DIGEST_TOOL = "post_weekly_digest";

/** The four sections, in the order the digest shows them. */
export const DIGEST_SECTIONS = [
  { key: "shipped", heading: "Shipped" },
  { key: "atRisk", heading: "At risk" },
  { key: "needsDecision", heading: "Needs decision" },
  { key: "blocked", heading: "Blocked" },
] as const;

const lines = z
  .array(
    z.object({
      taskId: z.string().trim().min(1).describe("The ticket's id"),
      note: z
        .string()
        .trim()
        .max(300)
        .optional()
        .describe("One short line on the ticket"),
    }),
  )
  .max(25);

export const digestSchema = z.object({
  workProjectId: z
    .string()
    .trim()
    .min(1)
    .describe("The project the digest is posted to, from list_work_projects"),
  shipped: lines.describe("Tickets finished this week"),
  atRisk: lines.describe("Tickets likely to slip"),
  needsDecision: lines.describe("Tickets waiting on someone's decision"),
  blocked: lines.describe("Tickets that cannot move"),
});
export type DigestArgs = z.output<typeof digestSchema>;

export const DIGEST_DESCRIPTION =
  "Draft the weekly digest: name the tickets under shipped, at risk, needs decision and blocked. Nothing is posted: it becomes a draft on Pulse that a person accepts.";

export const POST_DIGEST_DESCRIPTION =
  "Post an accepted weekly digest as a project update.";

export const postDigestSchema = projectUpdateSchema;

export const postDigest = (
  client: ToolClient,
  args: z.output<typeof postDigestSchema>,
) => postProjectUpdate(client, args);

// Drafting only ever proposes; the tool never runs on its own.
export const refuseDigestRun = async () => {
  throw new Error("The digest needs a person to accept it.");
};
