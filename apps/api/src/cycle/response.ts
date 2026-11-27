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
    summary: z
      .object({
        completed: z.number().int().openapi({
          description: "Issues finished when the cycle ended.",
        }),
        addedAfterStart: z.number().int().openapi({
          description: "Issues that joined the cycle after it started.",
        }),
        carriedOver: z.number().int().openapi({
          description: "Issues still open when the cycle ended.",
        }),
      })
      .nullable()
      .openapi({
        description:
          "Team totals snapshotted when the cycle completes; null until then. Canceled and archived issues are excluded.",
      }),
  })
  .openapi("Cycle");

export const cycleListSchema = z.array(cycleSchema);
