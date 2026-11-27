import { desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { safeErrorCode } from "../admin/system/safe-error-code";
import db from "../database";
import { backupRunTable } from "../database/schema";
import { withJobLease } from "../scheduler/leader-lock";
import { readBackupConfig } from "./config";
import { COUNTED_TABLES, type TableCounts } from "./counted-tables";
import { countTables } from "./dump-database";
import { withLiveClient } from "./live-client";
import { downloadBackup } from "./offsite-store";
import { restoreDump } from "./restore-dump";
import { withScratchDatabase } from "./scratch-database";
import { withTempFile } from "./temp-file";

const LEASE_MS = 2 * 60 * 60 * 1000;

function sameCounts(a: TableCounts, b: Partial<TableCounts> | null) {
  return (Object.keys(COUNTED_TABLES) as (keyof TableCounts)[]).every(
    (key) => a[key] === b?.[key],
  );
}

/**
 * Restores the latest offsite backup into a scratch database, counts the rows
 * a person would miss most, and drops the scratch database again. The result
 * passes when the restored counts equal those taken when the dump was made.
 */
export async function testRestore() {
  const config = readBackupConfig();
  if (!config) {
    throw new HTTPException(409, {
      message: "Backups are off: offsite storage is not configured",
    });
  }
  const [latest] = await db
    .select()
    .from(backupRunTable)
    .where(eq(backupRunTable.status, "succeeded"))
    .orderBy(desc(backupRunTable.startedAt))
    .limit(1);
  if (!latest?.objectKey) {
    throw new HTTPException(409, { message: "No backup to restore yet" });
  }
  const objectKey = latest.objectKey;

  return withJobLease(
    "backup-restore-test",
    async () => {
      const startedAt = Date.now();
      const live = await withLiveClient(countTables);
      let restored: TableCounts | null = null;
      let errorCode: string | null = null;
      try {
        restored = await withTempFile("restore.ndjson.gz", async (file) => {
          await downloadBackup(config, objectKey, file);
          return withScratchDatabase(async (client) => {
            await restoreDump(client, file);
            return countTables(client);
          });
        });
      } catch (error) {
        console.error("Backup restore test failed", safeErrorCode(error));
        errorCode = safeErrorCode(error);
      }
      const atBackup = (latest.counts ?? null) as TableCounts | null;
      const passed = restored !== null && sameCounts(restored, atBackup);
      if (restored && !passed) errorCode = "COUNT_MISMATCH";
      return {
        status: passed ? ("passed" as const) : ("failed" as const),
        errorCode,
        backupId: latest.id,
        backupStartedAt: latest.startedAt.toISOString(),
        restored,
        atBackup,
        live,
        durationMs: Date.now() - startedAt,
      };
    },
    () => {
      throw new HTTPException(409, {
        message: "A restore test is already running",
      });
    },
    LEASE_MS,
  );
}
