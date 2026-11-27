import { CloudUploadIcon, DatabaseBackupIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { StatusBadge } from "@/components/settings/status-badge";
import type { AdminBackupRun } from "@/fetchers/admin/backup-types";
import { formatDateTime } from "@/lib/format";
import { formatFileSize } from "@/lib/upload-task-image";

type LastBackupSectionProps = {
  lastSuccess: AdminBackupRun | null;
};

export function LastBackupSection({ lastSuccess }: LastBackupSectionProps) {
  const { t, i18n } = useTranslation();

  return (
    <SettingsSection
      title={t("settings:adminBackups.last.title")}
      description={t("settings:adminBackups.last.description")}
    >
      <SettingsCard>
        <SettingsRow
          icon={<DatabaseBackupIcon />}
          title={t("settings:adminBackups.last.backup")}
          description={
            lastSuccess
              ? t("settings:adminBackups.last.summary", {
                  time: formatDateTime(lastSuccess.startedAt, i18n.language),
                  size: formatFileSize(lastSuccess.sizeBytes ?? 0),
                })
              : t("settings:adminBackups.last.none")
          }
        />
        <SettingsRow
          icon={<CloudUploadIcon />}
          title={t("settings:adminBackups.last.offsite")}
        >
          {lastSuccess?.offsiteStatus === "ok" ? (
            <StatusBadge tone="success">
              {t("settings:adminBackups.last.offsiteOk")}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">
              {t("settings:adminBackups.last.offsiteNone")}
            </StatusBadge>
          )}
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
