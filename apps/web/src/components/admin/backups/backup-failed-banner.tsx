import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AdminBackupRun } from "@/fetchers/admin/backup-types";
import { formatDateTime } from "@/lib/format";

type BackupFailedBannerProps = {
  run: AdminBackupRun;
};

export function BackupFailedBanner({ run }: BackupFailedBannerProps) {
  const { t, i18n } = useTranslation();

  return (
    <Alert variant="error">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle>{t("settings:adminBackups.failed.title")}</AlertTitle>
      <AlertDescription>
        {t("settings:adminBackups.failed.description", {
          time: formatDateTime(run.startedAt, i18n.language),
          code: run.errorCode ?? "UNKNOWN",
        })}
      </AlertDescription>
    </Alert>
  );
}
