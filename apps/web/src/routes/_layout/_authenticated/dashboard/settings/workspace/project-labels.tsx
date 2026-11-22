import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { ProjectLabelsSettings } from "@/components/settings/project-labels/project-labels-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/project-labels",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:projectLabels.title")} />
      <ProjectLabelsSettings />
    </>
  );
}
