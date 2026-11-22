import { ESTIMATE_TYPES } from "../estimate/scales";
import { z } from "../openapi";

export const projectParam = z.object({ id: z.string() });

export const workspaceIdQuery = z.object({ workspaceId: z.string() });

export const listProjectsQuery = z.object({
  workspaceId: z.string(),
  includeArchived: z.string().optional().openapi({
    description: 'Pass "true" to include archived projects in the list.',
  }),
});

export const createProjectBody = z.object({
  name: z.string(),
  workspaceId: z.string(),
  icon: z.string(),
  slug: z.string(),
});

export const updateProjectBody = z.object({
  name: z.string(),
  icon: z.string(),
  slug: z.string(),
  description: z.string(),
  isPublic: z.boolean(),
  includeSubtasks: z.boolean().optional(),
  autoArchiveMonths: z.number().int().min(0).max(120).optional(),
  estimateType: z.enum(ESTIMATE_TYPES).optional().openapi({
    description: "Issue estimation scale: none turns estimates off.",
  }),
  estimateExtended: z.boolean().optional(),
  estimateAllowZero: z.boolean().optional(),
  estimateCountUnestimated: z.boolean().optional(),
});

export const reorderProjectsBody = z.object({
  // Positions express a relative order only; the controller renumbers the
  // workspace to 0..n-1, so the values just have to be sane.
  projects: z
    .array(z.object({ id: z.string(), position: z.number().int().min(0) }))
    .min(1),
});

export const uploadProjectBackgroundBody = z.object({
  contentType: z.string(),
  size: z.number(),
});

export const finalizeProjectBackgroundBody = z.object({
  key: z.string(),
  contentType: z.string(),
  version: z.string(),
  size: z.number(),
});
export const moveProjectBody = z.object({ workspaceId: z.string().min(1) });

export const updateTeamMembershipBody = z
  .object({
    joined: z.boolean().optional().openapi({
      description:
        "False leaves the team: it drops out of your sidebar and its subscriptions are cleared. Access to the team's issues is unchanged.",
    }),
    notifyIssueAdded: z.boolean().optional(),
    notifyIssueClosed: z.boolean().optional(),
    notifyIssueTriage: z.boolean().optional(),
  })
  .openapi("UpdateTeamMembership");
