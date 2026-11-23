import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

const progress = z.object({
  total: z.number().int(),
  done: z.number().int(),
});

export const workProjectMilestoneSchema = z
  .object({
    id: z.string(),
    workProjectId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    targetDate: nullableResponseTimestamp,
    sortOrder: z.number().int(),
    createdAt: responseTimestamp,
    progress,
  })
  .openapi("WorkProjectMilestone");

export const workProjectSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    color: z.string(),
    status: z.string(),
    health: z.string().nullable(),
    priority: z.number().int(),
    leadId: z.string().nullable(),
    startDate: nullableResponseTimestamp,
    targetDate: nullableResponseTimestamp,
    summary: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    teamIds: z.array(z.string()),
    memberIds: z.array(z.string()),
    labelIds: z.array(z.string()),
    progress,
  })
  .openapi("WorkProject");

export const workProjectDetailSchema = workProjectSchema
  .extend({ milestones: z.array(workProjectMilestoneSchema) })
  .openapi("WorkProjectDetail");

export const workProjectListSchema = z.array(workProjectSchema);
export const deletedSchema = z.object({ id: z.string() });

export const workProjectUpdateSchema = z
  .object({
    id: z.string(),
    workProjectId: z.string(),
    workProjectName: z.string(),
    userId: z.string().nullable(),
    userName: z.string().nullable(),
    userImage: z.string().nullable(),
    health: z.string(),
    body: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("WorkProjectUpdate");

export const workProjectUpdateListSchema = z.array(workProjectUpdateSchema);

export const workProjectCommentSchema = z
  .object({
    id: z.string(),
    workProjectId: z.string(),
    userId: z.string().nullable(),
    userName: z.string().nullable(),
    userImage: z.string().nullable(),
    content: z.string(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("WorkProjectComment");

export const workProjectCommentListSchema = z.array(workProjectCommentSchema);
