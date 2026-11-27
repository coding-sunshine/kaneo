import { brand } from "@kaneo/brand";
import { z } from "../openapi";

export const WORK_PROJECT_STATUSES = [
  "backlog",
  "planned",
  "started",
  "paused",
  "completed",
  "canceled",
] as const;
export const WORK_PROJECT_HEALTHS = ["onTrack", "atRisk", "offTrack"] as const;

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const workProjectParam = z.object({ id: z.string() });
export const updateParam = z.object({ id: z.string() });
export const milestoneParam = z.object({ id: z.string() });

export const listWorkProjectsQuery = z.object({
  teamId: z
    .string()
    .optional()
    .openapi({
      description: `Only projects linked to this team (${brand.name} project).`,
    }),
});

const date = z
  .string()
  .nullable()
  .openapi({ description: "ISO date-time; null clears the date." });

const fields = {
  name: z.string().trim().min(1).max(255),
  icon: z.string().max(64).nullable(),
  color: z.string().max(32),
  status: z.enum(WORK_PROJECT_STATUSES),
  health: z.enum(WORK_PROJECT_HEALTHS).nullable(),
  priority: z.number().int().min(0).max(4),
  leadId: z.string().nullable(),
  startDate: date,
  targetDate: date,
  summary: z.string().max(1000).nullable(),
  description: z.string().nullable(),
  teamIds: z.array(z.string()),
  memberIds: z.array(z.string()),
};

export const createWorkProjectBody = z.object({
  ...fields,
  workspaceId: z.string(),
  icon: fields.icon.optional(),
  color: fields.color.optional(),
  status: fields.status.optional(),
  health: fields.health.optional(),
  priority: fields.priority.optional(),
  leadId: fields.leadId.optional(),
  startDate: date.optional(),
  targetDate: date.optional(),
  summary: fields.summary.optional(),
  description: fields.description.optional(),
  teamIds: fields.teamIds.optional(),
  memberIds: fields.memberIds.optional(),
});

export const updateWorkProjectBody = z.object(fields).partial();

export const createMilestoneBody = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().nullable().optional(),
  targetDate: date.optional(),
});

export const updateMilestoneBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  targetDate: date.optional(),
  sortOrder: z.number().int().optional(),
});

export const createUpdateBody = z.object({
  health: z.enum(WORK_PROJECT_HEALTHS),
  body: z.string().max(20000).default(""),
});

export const updateUpdateBody = createUpdateBody.partial();

export const linkParam = z.object({ id: z.string(), linkId: z.string() });

// A link opens in the reader's browser: only a web address, or a path inside
// the app. A backslash is refused because browsers read "/\host" as "//host".
const linkUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(/^(https?:\/\/[^\s/\\]|\/(?![/\\]))[^\s\\]*$/i, {
    message: "A link is a web address or a path inside the app",
  });

export const linkBody = z.object({
  url: linkUrl,
  label: z.string().trim().max(255).optional(),
});

export const commentBody = z.object({
  content: z.string().trim().min(1).max(20000),
});

export const dependencyBody = z.object({
  dependsOnId: z.string().openapi({
    description: "The project this one waits on, in the same workspace.",
  }),
});

export const dependencyParam = z.object({
  id: z.string(),
  dependsOnId: z.string(),
});
