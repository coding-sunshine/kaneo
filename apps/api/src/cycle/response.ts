import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const cycleSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    number: z.number().int(),
    name: z.string().nullable(),
    startsAt: responseTimestamp,
    endsAt: responseTimestamp,
    completedAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    progress: z.object({
      total: z.number().int().openapi({
        description: "Issues in the cycle, canceled and archived excluded.",
      }),
      started: z.number().int(),
      done: z.number().int(),
    }),
  })
  .openapi("Cycle");

export const cycleListSchema = z.array(cycleSchema);
