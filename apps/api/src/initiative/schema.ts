import { z } from "../openapi";
import { WORK_PROJECT_HEALTHS } from "../work-project/schema";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
export const initiativeParam = z.object({ id: z.string() });

const date = z
  .string()
  .nullable()
  .openapi({ description: "ISO date-time; null clears the date." });

const fields = {
  name: z.string().trim().min(1).max(255),
  description: z.string().max(20000).nullable(),
  ownerId: z.string().nullable(),
  targetDate: date,
  workProjectIds: z.array(z.string()).openapi({
    description: "The projects under this initiative; replaces the full set.",
  }),
};

export const createInitiativeBody = z.object({
  workspaceId: z.string(),
  name: fields.name,
  description: fields.description.optional(),
  ownerId: fields.ownerId.optional(),
  targetDate: fields.targetDate.optional(),
  workProjectIds: fields.workProjectIds.optional(),
});

export const updateInitiativeBody = z.object(fields).partial();

export const createInitiativeUpdateBody = z.object({
  health: z.enum(WORK_PROJECT_HEALTHS),
  body: z.string().max(20000).default(""),
});
