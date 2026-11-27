import { desc, eq } from "drizzle-orm";
import db from "../database";
import { backupRunTable } from "../database/schema";
import { MISSING_BACKUP_ENV, readBackupConfig } from "./config";

// A run still "running" after this long died with its process.
const STALE_RUN_MS = 6 * 60 * 60 * 1000;

type Run = typeof backupRunTable.$inferSelect;

function present(run: Run | undefined) {
  if (!run) return null;
  const stale =
    run.status === "running" &&
    run.startedAt.getTime() < Date.now() - STALE_RUN_MS;
  return {
    id: run.id,
    status: stale ? ("failed" as const) : run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    sizeBytes: run.sizeBytes,
    offsiteStatus: run.offsiteStatus,
    errorCode: stale ? "INTERRUPTED" : run.errorCode,
  };
}

export async function getBackupStatus() {
  const enabled = readBackupConfig() !== null;
  const [lastRun] = await db
    .select()
    .from(backupRunTable)
    .orderBy(desc(backupRunTable.startedAt))
    .limit(1);
  const [lastSuccess] = await db
    .select()
    .from(backupRunTable)
    .where(eq(backupRunTable.status, "succeeded"))
    .orderBy(desc(backupRunTable.startedAt))
    .limit(1);
  return {
    enabled,
    missingEnv: enabled ? [] : [...MISSING_BACKUP_ENV],
    lastRun: present(lastRun),
    lastSuccess: present(lastSuccess),
  };
}
