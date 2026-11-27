import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import AiAuditPanel from "@/components/settings/ai-audit/ai-audit-panel";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/ai-audit",
)({ component: RouteComponent });
function RouteComponent() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("settings:aiAudit.title")} />
      <AiAuditPanel />
    </>
  );
}
