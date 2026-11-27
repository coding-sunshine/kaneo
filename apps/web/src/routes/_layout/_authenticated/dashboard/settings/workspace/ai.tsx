import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import AiDestinationPanel from "@/components/settings/ai-destination/ai-destination-panel";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/ai",
)({ component: RouteComponent });
function RouteComponent() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("settings:aiDestination.title")} />
      <AiDestinationPanel />
    </>
  );
}
