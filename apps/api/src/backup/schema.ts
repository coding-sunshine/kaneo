import { z } from "../openapi";

const errorCode = z.string().nullable().openapi({
  description:
    "Short failure category such as ECONNREFUSED, InternalError or COUNT_MISMATCH. Never contains hosts, credentials or server messages.",
});

const tableCountsSchema = z.object({
  tickets: z.number().int(),
  documents: z.number().int(),
  chatMessages: z.number().int(),
});

const backupRunSchema = z.object({
  id: z.string(),
  status: z.enum(["running", "succeeded", "failed"]),
  startedAt: z.string().openapi({ format: "date-time" }),
  finishedAt: z.string().nullable().openapi({ format: "date-time" }),
  sizeBytes: z.number().int().nullable(),
  offsiteStatus: z.enum(["ok", "failed"]).nullable(),
  errorCode,
});

export const backupStatusSchema = z
  .object({
    enabled: z.boolean().openapi({
      description:
        "False until the offsite bucket and its keys are set on the server.",
    }),
    missingEnv: z.array(z.string()).openapi({
      description: "Names of the server settings to set to turn backups on.",
    }),
    lastRun: backupRunSchema.nullable(),
    lastSuccess: backupRunSchema.nullable(),
  })
  .openapi("BackupStatus");

export const restoreTestResultSchema = z
  .object({
    status: z.enum(["passed", "failed"]),
    errorCode,
    backupId: z.string(),
    backupStartedAt: z.string().openapi({ format: "date-time" }),
    restored: tableCountsSchema.nullable(),
    atBackup: tableCountsSchema.nullable(),
    live: tableCountsSchema,
    durationMs: z.number().int(),
  })
  .openapi("BackupRestoreTest");
