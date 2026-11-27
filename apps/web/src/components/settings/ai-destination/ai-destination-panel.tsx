import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { useAiDestination } from "@/hooks/queries/agent/use-ai-destination";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { AiDestinationForm } from "./ai-destination-form";

/** Settings, AI: which provider receives the workspace's text, and which model. */
export default function AiDestinationPanel() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data, isLoading, isError, refetch } = useAiDestination(workspaceId);

  return (
    <SettingsPage
      title={t("settings:aiDestination.title")}
      description={t("settings:aiDestination.description")}
    >
      {isLoading ? (
        <SettingsCard>
          <SettingsRowsSkeleton rows={2} />
        </SettingsCard>
      ) : null}
      {isError ? (
        <SettingsCard>
          <DirectoryErrorRow
            message={t("settings:aiDestination.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        </SettingsCard>
      ) : null}
      {data ? (
        <>
          <SettingsSection title={t("settings:aiDestination.current")}>
            <SettingsCard>
              <SettingsRow
                title={t("settings:aiDestination.receiver")}
                description={t(
                  `settings:aiDestination.receiverHint.${data.provider === "openrouter" ? "openrouter" : "selfHosted"}`,
                )}
              >
                <span className="font-medium text-sm">
                  {t(
                    `settings:aiDestination.providers.${data.provider === "openrouter" ? "openrouter" : "selfHosted"}`,
                  )}
                </span>
              </SettingsRow>
              <SettingsRow
                title={t("settings:aiDestination.model")}
                description={
                  data.host
                    ? t("settings:aiDestination.host", { host: data.host })
                    : undefined
                }
              >
                <span className="break-all font-mono text-sm">
                  {data.model ?? t("settings:aiDestination.noModel")}
                </span>
              </SettingsRow>
            </SettingsCard>
          </SettingsSection>
          <SettingsSection
            title={t("settings:aiDestination.change")}
            description={
              data.canChange
                ? t("settings:aiDestination.changeHint")
                : t("settings:aiDestination.adminsOnly")
            }
          >
            <AiDestinationForm
              key={`${data.provider}:${data.model}`}
              workspaceId={workspaceId}
              destination={data}
            />
          </SettingsSection>
        </>
      ) : null}
    </SettingsPage>
  );
}
