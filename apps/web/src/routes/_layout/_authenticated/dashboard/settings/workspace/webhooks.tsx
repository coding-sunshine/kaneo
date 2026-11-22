import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import WorkspaceWebhooksPanel from "@/components/settings/workspace-webhooks/webhooks-panel";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/webhooks",
)({ component: RouteComponent });
function RouteComponent() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("settings:workspaceWebhooks.title")} />
      <WorkspaceWebhooksPanel />
    </>
  );
}
