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
    teamIds: z.array(z.string()).openapi({
      description: "The project's teams that you can open.",
    }),
    canOpenDocuments: z.boolean().openapi({
      description:
        "Whether you can open the project's documents and put a document in it: the project has no team, or you can open one of its teams.",
    }),
    memberIds: z.array(z.string()),
    labelIds: z.array(z.string()),
    dependsOnIds: z.array(z.string()).openapi({
      description: "Projects this project waits on.",
    }),
    dependentIds: z.array(z.string()).openapi({
      description: "Projects that wait on this project.",
    }),
    progress,
  })
  .openapi("WorkProject");

export const workProjectLinkSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    label: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("WorkProjectLink");

export const workProjectDetailSchema = workProjectSchema
  .extend({
    milestones: z.array(workProjectMilestoneSchema),
    links: z.array(workProjectLinkSchema),
  })
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
