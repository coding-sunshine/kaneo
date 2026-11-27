import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { useAiAudit } from "@/hooks/queries/agent/use-ai-audit";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { AiAuditRow } from "./ai-audit-row";
import { AiAuditSettingRow } from "./ai-audit-setting-row";

/** Settings, AI audit: every agent write someone accepted, and every change of the AI data destination, newest first. */
export default function AiAuditPanel() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data, isLoading, isError, refetch } = useAiAudit(workspaceId);

  return (
    <SettingsPage
      title={t("settings:aiAudit.title")}
      description={t("settings:aiAudit.description")}
    >
      <SettingsCard role="list" aria-label={t("settings:aiAudit.title")}>
        {isLoading ? <SettingsRowsSkeleton rows={3} /> : null}
        {isError ? (
          <DirectoryErrorRow
            message={t("settings:aiAudit.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        ) : null}
        {data?.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("settings:aiAudit.empty")}
          </p>
        ) : null}
        {data?.map((row) =>
          row.kind === "setting" ? (
            <AiAuditSettingRow key={row.id} row={row} />
          ) : (
            <AiAuditRow key={row.id} workspaceId={workspaceId} row={row} />
          ),
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
