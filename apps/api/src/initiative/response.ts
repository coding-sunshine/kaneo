import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { workProjectSchema } from "../work-project/response";
import { WORK_PROJECT_HEALTHS } from "../work-project/schema";

const health = z.enum(WORK_PROJECT_HEALTHS).nullable();

export const initiativeSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    ownerId: z.string().nullable(),
    targetDate: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    workProjectIds: z.array(z.string()),
    health: health.openapi({
      description: "The health of the initiative's latest update.",
    }),
    rolledUpHealth: health.openapi({
      description:
        "The worst of the latest update's health and the health of the initiative's open projects.",
    }),
    progress: z
      .object({ total: z.number().int(), done: z.number().int() })
      .openapi({
        description:
          "Issues across the initiative's projects that you can open: all of them and the done ones.",
      }),
  })
  .openapi("Initiative");

export const initiativeListSchema = z.array(initiativeSchema);

export const initiativeDetailSchema = initiativeSchema
  .extend({ workProjects: z.array(workProjectSchema) })
  .openapi("InitiativeDetail");

export const initiativeUpdateSchema = z
  .object({
    id: z.string(),
    initiativeId: z.string(),
    initiativeName: z.string(),
    userId: z.string().nullable(),
    userName: z.string().nullable(),
    userImage: z.string().nullable(),
    health: z.string(),
    body: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("InitiativeUpdate");

export const initiativeUpdateListSchema = z.array(initiativeUpdateSchema);
