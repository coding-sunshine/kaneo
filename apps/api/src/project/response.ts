import { HTTPException } from "hono/http-exception";
import { type EstimateSettings, estimateOptions } from "../estimate/scales";
import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { boardColumnSchema, boardTaskSchema } from "../task/response";

export const projectSchema = z
  .object({
    includeSubtasks: z.boolean().optional(),
    autoArchiveMonths: z.number().optional(),
    cyclesEnabled: z.boolean().optional(),
    cycleDurationWeeks: z.number().optional(),
    cycleCooldownWeeks: z.number().optional(),
    cycleStartDay: z.number().optional(),
    cycleUpcomingCount: z.number().optional(),
    cycleAutoAddStarted: z.boolean().optional(),
    cycleAutoAddCompleted: z.boolean().optional(),
    cycleAutoRollover: z.boolean().optional(),
    slaEnabled: z.boolean().optional(),
    slaUrgentHours: z.number().optional(),
    slaHighHours: z.number().optional(),
    triageResponsibilityMode: z.string().optional(),
    estimateType: z.string().optional(),
    estimateExtended: z.boolean().optional(),
    estimateAllowZero: z.boolean().optional(),
    estimateCountUnestimated: z.boolean().optional(),
    estimateOptions: z
      .array(z.object({ value: z.number(), label: z.string() }))
      .optional()
      .openapi({
        description:
          "The points an issue can take on this team's estimate scale; empty when estimates are off.",
      }),
    id: z.string(),
    workspaceId: z.string(),
    backgroundVersion: z.string().nullable(),
    slug: z.string().openapi({
      description: "Short prefix used in task identifiers, e.g. KAN-12.",
    }),
    icon: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    isPublic: z.boolean().nullable().openapi({
      description:
        "When true the project's board is readable without signing in, via /api/public-project/{id}.",
    }),
    isPrivate: z.boolean().openapi({
      description:
        "When true only the team's members, the workspace owner and instance administrators can open the team.",
    }),
    archivedAt: nullableResponseTimestamp.openapi({
      description:
        "Non-null once archived; archived projects are hidden by default.",
    }),
    position: z.number().openapi({ description: "Sidebar order, ascending." }),
    lastTaskNumber: z.number().openapi({
      description:
        "Highest task number issued in this project; the next task gets this plus one.",
    }),
  })
  .openapi("Project");

export const projectStatisticsSchema = z
  .object({
    completionPercentage: z.number(),
    totalTasks: z.number(),
    dueDate: nullableResponseTimestamp.openapi({
      description: "The soonest due date among the project's open tasks.",
    }),
  })
  .openapi("ProjectStatistics");

export const teamMembershipSchema = z
  .object({
    joined: z.boolean().openapi({
      description:
        "False once you left the team. Leaving only hides it from your sidebar.",
    }),
    notifyIssueAdded: z.boolean().openapi({
      description: "Notify you when an issue is added to the team.",
    }),
    notifyIssueClosed: z.boolean().openapi({
      description: "Notify you when an issue is completed or canceled.",
    }),
    notifyIssueTriage: z.boolean().openapi({
      description: "Notify you when an issue is added to the triage queue.",
    }),
  })
  .openapi("TeamMembership");

export const privateTeamMembersSchema = z
  .object({
    projectId: z.string(),
    userIds: z.array(z.string()).openapi({
      description:
        "The workspace members added to the private team. The workspace owner and instance administrators can open every team and are not listed.",
    }),
  })
  .openapi("PrivateTeamMembers");

export const privateTeamMembersListSchema = z.array(privateTeamMembersSchema);

export const projectListItemSchema = projectSchema
  .extend({
    statistics: projectStatisticsSchema,
    memberCount: z.number().openapi({
      description: "Workspace members who can open this team.",
    }),
    membership: teamMembershipSchema,
    // Legacy, always empty. Fetch the board via GET /task/tasks/{id}.
    archivedTasks: z
      .array(boardTaskSchema)
      .openapi({ description: "Always empty." }),
    plannedTasks: z
      .array(boardTaskSchema)
      .openapi({ description: "Always empty." }),
    columns: z
      .array(boardColumnSchema)
      .openapi({ description: "Always empty." }),
  })
  .openapi("ProjectListItem");

export const projectListSchema = z.array(projectListItemSchema);

export const projectBackgroundUploadSchema = z
  .object({
    key: z.string(),
    uploadUrl: z.string(),
    version: z.string(),
    headers: z.record(z.string(), z.string()),
  })
  .openapi("ProjectBackgroundUpload");

export const projectBackgroundFinalizeSchema = z
  .object({ url: z.string() })
  .openapi("ProjectBackgroundFinalize");
export const movedProjectSchema = projectSchema
  .extend({ unassignedTaskCount: z.number() })
  .openapi("MovedProject");

// Storage coordinates are private implementation details, even on mutations
// that return a full database row. Preserve each endpoint's other fields.
export function toPublicProject<
  T extends {
    backgroundObjectKey: string | null;
    backgroundMimeType: string | null;
  } & EstimateSettings,
>(project: T | undefined) {
  if (!project)
    throw new HTTPException(500, {
      message: "Project mutation returned no result",
    });
  const {
    backgroundObjectKey: _key,
    backgroundMimeType: _mime,
    ...publicProject
  } = project;
  return { ...publicProject, estimateOptions: estimateOptions(project) };
}
