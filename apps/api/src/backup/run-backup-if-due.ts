import { and, desc, eq, gt } from "drizzle-orm";
import db from "../database";
import { backupRunTable } from "../database/schema";
import { withJobLease } from "../scheduler/leader-lock";
import { MISSING_BACKUP_ENV, readBackupConfig } from "./config";
import { runBackup } from "./run-backup";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 60 * 60 * 1000;
// A dump of a large instance can take a while; keep other instances out.
const LEASE_MS = 6 * 60 * 60 * 1000;

let warnedOff = false;

async function isDue() {
  const now = Date.now();
  const [recentSuccess] = await db
    .select({ id: backupRunTable.id })
    .from(backupRunTable)
    .where(
      and(
        eq(backupRunTable.status, "succeeded"),
        gt(backupRunTable.startedAt, new Date(now - DAY_MS + RETRY_MS)),
      ),
    )
    .limit(1);
  if (recentSuccess) return false;
  // After a failure, wait an hour before trying again.
  const [latest] = await db
    .select({ startedAt: backupRunTable.startedAt })
    .from(backupRunTable)
    .orderBy(desc(backupRunTable.startedAt))
    .limit(1);
  return !latest || latest.startedAt.getTime() <= now - RETRY_MS;
}

/** Runs hourly: makes a backup when none has succeeded in the last day. */
export async function runBackupIfDue() {
  const config = readBackupConfig();
  if (!config) {
    if (!warnedOff) {
      warnedOff = true;
      console.warn(
        `Scheduled backups are off: set ${MISSING_BACKUP_ENV.join(", ")} to turn them on.`,
      );
    }
    return;
  }
  await withJobLease(
    "database-backup",
    async () => {
      if (await isDue()) await runBackup(config);
    },
    () => undefined,
    LEASE_MS,
  );
}
