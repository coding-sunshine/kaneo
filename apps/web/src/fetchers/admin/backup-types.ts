import type { getAdminBackups } from "./get-admin-backups";
import type { testAdminBackupRestore } from "./test-admin-backup-restore";

export type AdminBackupStatus = Awaited<ReturnType<typeof getAdminBackups>>;

export type AdminBackupRun = NonNullable<AdminBackupStatus["lastRun"]>;

export type AdminRestoreTest = Awaited<
  ReturnType<typeof testAdminBackupRestore>
>;
