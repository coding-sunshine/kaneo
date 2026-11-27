import { resolveFileSecret } from "../utils/file-secret";

export type BackupConfig = {
  bucket: string;
  endpoint: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
  forcePathStyle: boolean;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

/**
 * Backups need an offsite bucket and its keys. Without all three the feature
 * stays off: the scheduler skips, and the admin page says what is missing.
 */
export function readBackupConfig(): BackupConfig | null {
  const bucket = env("BACKUP_S3_BUCKET");
  const accessKeyId = resolveFileSecret("BACKUP_S3_ACCESS_KEY_ID")?.trim();
  const secretAccessKey = resolveFileSecret(
    "BACKUP_S3_SECRET_ACCESS_KEY",
  )?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    endpoint: env("BACKUP_S3_ENDPOINT") || undefined,
    region: env("BACKUP_S3_REGION") || "us-east-1",
    accessKeyId,
    secretAccessKey,
    keyPrefix: env("BACKUP_S3_KEY_PREFIX").replace(/^\/+|\/+$/g, ""),
    forcePathStyle: env("BACKUP_S3_FORCE_PATH_STYLE").toLowerCase() !== "false",
  };
}

export const MISSING_BACKUP_ENV = [
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
] as const;
