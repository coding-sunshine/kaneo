import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useAdminBackups from "@/hooks/queries/admin/use-admin-backups";
import { BackupFailedBanner } from "./backup-failed-banner";
import { BackupsOffNotice } from "./backups-off-notice";
import { LastBackupSection } from "./last-backup-section";
import { RestoreTestSection } from "./restore-test-section";

function BackupsPanel() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAdminBackups();
  const { can } = useAdminAccess();
  const canManage = can("instance:settings");

  return (
    <SettingsPage title={t("settings:adminBackups.title")}>
      {isError ? (
        <SettingsCard>
          <DirectoryErrorRow
            message={t("settings:adminBackups.loadError")}
            retryLabel={t("settings:adminBackups.retry")}
            onRetry={() => refetch()}
          />
        </SettingsCard>
      ) : null}
      {isLoading ? (
        <SettingsCard aria-busy="true">
          <SettingsRowsSkeleton rows={3} withDescription />
        </SettingsCard>
      ) : null}
      {data ? (
        <>
          {data.lastRun?.status === "failed" ? (
            <BackupFailedBanner run={data.lastRun} />
          ) : null}
          {data.enabled ? null : (
            <BackupsOffNotice missingEnv={data.missingEnv} />
          )}
          <LastBackupSection lastSuccess={data.lastSuccess} />
          <RestoreTestSection
            canRun={canManage && data.enabled && data.lastSuccess !== null}
          />
        </>
      ) : null}
    </SettingsPage>
  );
}

export default BackupsPanel;
