import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import BackupsPanel from "@/components/admin/backups/backups-panel";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/backups",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:adminBackups.title")} />
      <BackupsPanel />
    </>
  );
}
