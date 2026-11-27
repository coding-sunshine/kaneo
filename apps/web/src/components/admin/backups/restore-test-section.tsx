import { RotateCcwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useTestAdminBackupRestore from "@/hooks/mutations/admin/use-test-admin-backup-restore";
import { RestoreTestResult } from "./restore-test-result";

type RestoreTestSectionProps = {
  canRun: boolean;
};

export function RestoreTestSection({ canRun }: RestoreTestSectionProps) {
  const { t } = useTranslation();
  const restoreTest = useTestAdminBackupRestore();

  return (
    <SettingsSection
      title={t("settings:adminBackups.restoreTest.title")}
      description={t("settings:adminBackups.restoreTest.description")}
    >
      <SettingsCard>
        <SettingsRow
          icon={<RotateCcwIcon />}
          title={t("settings:adminBackups.restoreTest.run")}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canRun || restoreTest.isPending}
            onClick={() => restoreTest.mutate()}
          >
            {restoreTest.isPending ? (
              <Spinner aria-hidden="true" />
            ) : (
              <RotateCcwIcon aria-hidden="true" />
            )}
            {restoreTest.isPending
              ? t("settings:adminBackups.restoreTest.running")
              : t("settings:adminBackups.restoreTest.button")}
          </Button>
        </SettingsRow>
        {restoreTest.data ? (
          <RestoreTestResult result={restoreTest.data} />
        ) : null}
      </SettingsCard>
    </SettingsSection>
  );
}
