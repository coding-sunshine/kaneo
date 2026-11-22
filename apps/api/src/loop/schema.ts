import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { chatMessageSchema } from "../agent/schema";
import { FREQUENCIES } from "./schedule";

export const workspaceParam = z.object({ workspaceId: z.string() });
export const loopParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
});
export const runParam = z.object({
  workspaceId: z.string(),
  id: z.string(),
  runId: z.string(),
});
export const listQuery = z.object({
  scope: z.enum(["mine", "all"]).default("all"),
});

const frequency = z.enum(FREQUENCIES);

export const createLoopBody = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(255),
  instructions: z.string().trim().min(1).max(10_000),
  frequency,
});

export const updateLoopBody = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  instructions: z.string().trim().min(1).max(10_000).optional(),
  frequency: frequency.optional(),
  enabled: z.boolean().optional(),
});

export const loopSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    creatorId: z.string(),
    creatorName: z.string().nullable(),
    name: z.string(),
    instructions: z.string(),
    frequency,
    enabled: z.boolean(),
    nextRunAt: responseTimestamp,
    lastRunAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
  })
  .openapi("Loop");

export const loopListSchema = z.array(loopSchema);

export const runSummarySchema = z
  .object({
    id: z.string(),
    trigger: z.enum(["schedule", "manual"]),
    status: z.enum(["running", "succeeded", "failed"]),
    error: z.string().nullable(),
    startedAt: responseTimestamp,
    finishedAt: nullableResponseTimestamp,
  })
  .openapi("LoopRunSummary");

export const runListSchema = z.array(runSummarySchema);

export const runDetailSchema = runSummarySchema
  .extend({ messages: z.array(chatMessageSchema) })
  .openapi("LoopRun");

export const deletedLoopSchema = z.object({ id: z.string() });
