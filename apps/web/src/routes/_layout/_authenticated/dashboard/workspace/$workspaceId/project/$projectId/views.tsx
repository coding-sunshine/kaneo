import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { SaveViewDialog } from "@/components/views/save-view-dialog";
import { ViewList } from "@/components/views/view-list";
import { Button } from "@/components/ui/button";
import { useViews } from "@/hooks/queries/view/use-views";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/views",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, projectId } = Route.useParams();
  const [saving, setSaving] = useState(false);
  const { data: views = [] } = useViews(workspaceId);
  const visible = views.filter(
    (view) => view.projectId === projectId || view.projectId === null,
  );

  return (
    <>
      <PageTitle title={t("navigation:views.pageTitle")} />
      <ProjectLayout
        projectId={projectId}
        workspaceId={workspaceId}
        showViewSwitcher={false}
        crumb={t("navigation:views.title")}
      >
        <div className="flex justify-end px-4 py-2">
          <Button size="sm" onClick={() => setSaving(true)}>
            <Plus />
            {t("navigation:views.newView")}
          </Button>
        </div>
        <ViewList workspaceId={workspaceId} views={visible} />
      </ProjectLayout>
      <SaveViewDialog
        open={saving}
        onOpenChange={setSaving}
        workspaceId={workspaceId}
        projectId={projectId}
      />
    </>
  );
}
