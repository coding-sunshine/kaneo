import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import AiUsagePanel from "@/components/settings/ai-usage/ai-usage-panel";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/ai-usage",
)({ component: RouteComponent });
function RouteComponent() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("settings:aiUsage.title")} />
      <AiUsagePanel />
    </>
  );
}
