import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { PeopleDirectory } from "@/components/people/people-directory";
import useGetWorkspaceMembers from "@/hooks/queries/workspace-users/use-get-workspace-members";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/people",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data: people = [] } = useGetWorkspaceMembers(workspaceId);

  return (
    <>
      <PageTitle title={t("team:people.pageTitle")} />
      <WorkspaceLayout title={t("team:people.pageTitle")}>
        <PeopleDirectory people={people} />
      </WorkspaceLayout>
    </>
  );
}
