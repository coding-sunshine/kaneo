import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { CreateInitiativeDialog } from "@/components/initiative/create-initiative-dialog";
import { InitiativeList } from "@/components/initiative/initiative-list";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/initiatives",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const [creating, setCreating] = useState(false);
  const { canCreateProjects } = useWorkspacePermission();
  const detail = useMatch({
    from: "/_layout/_authenticated/dashboard/workspace/$workspaceId/initiatives/$initiativeId",
    shouldThrow: false,
  });

  return (
    <>
      <PageTitle title={t("workspace:initiative.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:initiative.pageTitle")}
        headerActions={
          !detail && canCreateProjects() ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              {t("workspace:initiative.newInitiative")}
            </Button>
          ) : undefined
        }
      >
        {detail ? <Outlet /> : <InitiativeList workspaceId={workspaceId} />}
      </WorkspaceLayout>
      <CreateInitiativeDialog
        open={creating}
        onClose={() => setCreating(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
