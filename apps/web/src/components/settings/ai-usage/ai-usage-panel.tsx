import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { useAiUsage } from "@/hooks/queries/agent/use-ai-usage";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { AiBudgetForm } from "./ai-budget-form";
import { UsageList } from "./usage-list";

const FEATURE_LABELS: Record<string, string> = {
  assistant: "settings:aiUsage.features.assistant",
  loop: "settings:aiUsage.features.loop",
  "loop-draft": "settings:aiUsage.features.loopDraft",
};

/** Settings, AI usage: budgets, then tokens by feature and by day. */
export default function AiUsagePanel() {
  const { t, i18n } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data, isLoading, isError, refetch } = useAiUsage(workspaceId);
  const number = new Intl.NumberFormat(i18n.language);
  const tokens = (count: number) =>
    t("settings:aiUsage.tokens", { count, formatted: number.format(count) });
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return (
    <SettingsPage
      title={t("settings:aiUsage.title")}
      description={t("settings:aiUsage.description")}
    >
      {isLoading ? (
        <SettingsCard>
          <SettingsRowsSkeleton rows={3} />
        </SettingsCard>
      ) : null}
      {isError ? (
        <SettingsCard>
          <DirectoryErrorRow
            message={t("settings:aiUsage.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        </SettingsCard>
      ) : null}
      {data ? (
        <>
          <SettingsSection
            title={t("settings:aiUsage.budgets")}
            description={t("settings:aiUsage.monthUsed", {
              used: tokens(data.monthTokens),
            })}
          >
            <AiBudgetForm
              key={`${data.budget.userDailyTokens}:${data.budget.workspaceMonthlyTokens}`}
              workspaceId={workspaceId}
              budget={data.budget}
            />
          </SettingsSection>
          <SettingsSection
            title={t("settings:aiUsage.byFeature")}
            description={t("settings:aiUsage.period", { days: data.days })}
          >
            <UsageList
              label={t("settings:aiUsage.byFeature")}
              empty={t("settings:aiUsage.empty")}
              rows={data.byFeature.map((row) => ({
                key: row.feature,
                title: FEATURE_LABELS[row.feature]
                  ? t(FEATURE_LABELS[row.feature])
                  : row.feature,
                detail: tokens(row.tokens),
              }))}
            />
          </SettingsSection>
          <SettingsSection title={t("settings:aiUsage.byDay")}>
            <UsageList
              label={t("settings:aiUsage.byDay")}
              empty={t("settings:aiUsage.empty")}
              rows={data.byDay.map((row) => ({
                key: row.day,
                title: date.format(new Date(`${row.day}T00:00:00Z`)),
                detail: tokens(row.tokens),
              }))}
            />
          </SettingsSection>
        </>
      ) : null}
    </SettingsPage>
  );
}
