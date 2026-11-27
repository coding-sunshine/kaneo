import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { exportWorkspace } from "@/fetchers/workspace/export-workspace";
import { downloadBlob } from "@/lib/download-blob";
import { safeFileName } from "@/lib/safe-file-name";
import { toast } from "@/lib/toast";

type WorkspaceExportSectionProps = {
  workspaceId: string | undefined;
  workspaceName: string;
};

export function WorkspaceExportSection({
  workspaceId,
  workspaceName,
}: WorkspaceExportSectionProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const handleExport = async () => {
    if (!workspaceId) return;
    setPending(true);
    try {
      const zip = await exportWorkspace(workspaceId);
      downloadBlob(zip, safeFileName(`${workspaceName} export`, "zip"));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:workspaceGeneral.export.failed"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <SettingsSection title={t("settings:workspaceGeneral.export.title")}>
      <SettingsCard>
        <SettingsRow
          stack
          title={t("settings:workspaceGeneral.export.rowTitle")}
          description={t("settings:workspaceGeneral.export.description")}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!workspaceId || pending}
            onClick={handleExport}
          >
            {pending
              ? t("settings:workspaceGeneral.export.pending")
              : t("settings:workspaceGeneral.export.button")}
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
