import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers2, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { SaveViewDialog } from "@/components/views/save-view-dialog";
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
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-sm font-medium">{t("navigation:views.empty")}</p>
            <p className="text-sm text-muted-foreground">
              {t("navigation:views.emptyHint")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {visible.map((view) => (
              <li key={view.id}>
                <Link
                  to="/dashboard/workspace/$workspaceId/views/$viewId"
                  params={{ workspaceId, viewId: view.id }}
                  className="flex h-11 items-center gap-3 border-border/60 border-b px-4 text-[13px] hover:bg-accent/50"
                >
                  <Layers2 className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {view.name}
                  </span>
                  <span className="text-muted-foreground">
                    {view.projectId === null
                      ? t("navigation:views.scopeWorkspace")
                      : t("navigation:views.scopeTeam")}
                  </span>
                  <span className="w-32 truncate text-right text-muted-foreground">
                    {view.ownerName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
