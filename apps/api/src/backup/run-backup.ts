import { eq } from "drizzle-orm";
import { safeErrorCode } from "../admin/system/safe-error-code";
import db from "../database";
import { backupRunTable } from "../database/schema";
import type { BackupConfig } from "./config";
import { dumpDatabase } from "./dump-database";
import { withLiveClient } from "./live-client";
import { backupObjectKey, uploadBackup } from "./offsite-store";
import { withTempFile } from "./temp-file";

/**
 * Dumps the database, copies it to the offsite bucket and records the run.
 * Every failure ends as a failed run row, which the admin page shows.
 */
export async function runBackup(config: BackupConfig) {
  const [run] = await db
    .insert(backupRunTable)
    .values({ status: "running" })
    .returning();
  if (!run) throw new Error("Backup run was not recorded");
  const name = `kaneo-${run.startedAt.toISOString().replace(/[:.]/g, "-")}-${run.id}.ndjson.gz`;
  const objectKey = backupObjectKey(config, name);
  let stage = "dump" as "dump" | "offsite";
  try {
    await withTempFile(name, async (filePath) => {
      const { counts, sizeBytes } = await withLiveClient((client) =>
        dumpDatabase(client, filePath),
      );
      stage = "offsite";
      if (!(await uploadBackup(config, objectKey, filePath))) {
        throw Object.assign(new Error("Offsite size mismatch"), {
          code: "OFFSITE_SIZE_MISMATCH",
        });
      }
      await db
        .update(backupRunTable)
        .set({
          status: "succeeded",
          objectKey,
          sizeBytes,
          counts,
          offsiteStatus: "ok",
          finishedAt: new Date(),
        })
        .where(eq(backupRunTable.id, run.id));
    });
  } catch (error) {
    console.error(
      `Database backup failed during ${stage}`,
      safeErrorCode(error),
    );
    await db
      .update(backupRunTable)
      .set({
        status: "failed",
        offsiteStatus: stage === "offsite" ? "failed" : null,
        errorCode: safeErrorCode(error),
        finishedAt: new Date(),
      })
      .where(eq(backupRunTable.id, run.id));
  }
}
