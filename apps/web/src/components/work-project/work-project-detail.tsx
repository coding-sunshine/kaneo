import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteWorkProject,
  useUpdateWorkProject,
} from "@/hooks/mutations/work-project/use-work-project-mutations";
import { useGetWorkProject } from "@/hooks/queries/work-project/use-get-work-project";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { progressPercent } from "@/lib/work-project/progress";
import type { WorkProjectStatus } from "@/fetchers/work-project/types";
import { WorkProjectFields } from "./work-project-fields";
import { WorkProjectLabels } from "./work-project-labels";
import { WorkProjectIcon } from "./work-project-icon";
import { WorkProjectIssues } from "./work-project-issues";
import { WorkProjectMilestones } from "./work-project-milestones";
import { WorkProjectUpdates } from "./work-project-updates";
import { WorkProjectResources } from "./work-project-resources";

type Tab = "overview" | "issues";

type Props = { workspaceId: string; workProjectId: string };

export function WorkProjectDetail({ workspaceId, workProjectId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: project, isError } = useGetWorkProject(workProjectId);
  const { mutateAsync: update } = useUpdateWorkProject(workProjectId);
  const { mutateAsync: remove } = useDeleteWorkProject();
  const { canUpdateTasks, canUpdateProjects } = useWorkspacePermission();
  const [tab, setTab] = useState<Tab>("overview");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setSummary(project.summary ?? "");
    setDescription(project.description ?? "");
  }, [project]);

  if (isError) {
    return (
      <p role="alert" className="p-6 text-muted-foreground text-sm">
        {t("workspace:workProject.notFound")}
      </p>
    );
  }
  if (!project) return null;

  const editable = canUpdateTasks();
  const save = async (patch: Parameters<typeof update>[0]) => {
    try {
      await update(patch);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:workProject.detail.updateError"),
      );
    }
  };
  const percent = progressPercent(project.progress);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-[13px]">
        <Link
          to="/dashboard/workspace/$workspaceId/work-projects"
          params={{ workspaceId }}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("workspace:workProject.pageTitle")}
        </Link>
        <span className="text-muted-foreground">/</span>
        <WorkProjectIcon icon={project.icon} color={project.color} />
        <span className="font-medium">{project.name}</span>
        <div role="tablist" className="ml-4 flex gap-1">
          {(["overview", "issues"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "h-7 rounded-md px-2.5 text-[13px] transition-colors hover:bg-accent",
                tab === id ? "bg-accent font-medium" : "text-muted-foreground",
              )}
            >
              {t(`workspace:workProject.tabs.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {tab === "issues" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkProjectIssues
            workspaceId={workspaceId}
            workProjectId={workProjectId}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
            <div className="space-y-2">
              <Input
                unstyled
                value={name}
                readOnly={!editable}
                onChange={(e) => setName(e.target.value)}
                onBlur={() =>
                  name.trim() &&
                  name !== project.name &&
                  save({ name: name.trim() })
                }
                aria-label={t("workspace:workProject.detail.titleLabel")}
                className="w-full font-semibold text-2xl outline-none"
              />
              <Input
                unstyled
                value={summary}
                readOnly={!editable}
                onChange={(e) => setSummary(e.target.value)}
                onBlur={() =>
                  summary !== (project.summary ?? "") &&
                  save({ summary: summary.trim() || null })
                }
                placeholder={t(
                  "workspace:workProject.detail.summaryPlaceholder",
                )}
                aria-label={t(
                  "workspace:workProject.detail.summaryPlaceholder",
                )}
                className="w-full text-muted-foreground outline-none"
              />
            </div>

            <section className="space-y-2">
              <h2 className="font-medium text-sm">
                {t("workspace:workProject.detail.properties")}
              </h2>
              <WorkProjectFields
                workspaceId={workspaceId}
                disabled={!editable}
                value={{
                  status: project.status as WorkProjectStatus,
                  priority: project.priority,
                  leadId: project.leadId,
                  memberIds: project.memberIds,
                  teamIds: project.teamIds,
                  startDate: project.startDate,
                  targetDate: project.targetDate,
                }}
                onChange={(patch) => save(patch)}
              />
              <WorkProjectLabels
                workspaceId={workspaceId}
                workProjectId={workProjectId}
                labelIds={project.labelIds}
                disabled={!canUpdateProjects()}
              />
              <p className="text-muted-foreground text-xs">
                {t("workspace:workProject.detail.progress", {
                  done: project.progress.done,
                  total: project.progress.total,
                })}{" "}
                ({percent}%)
              </p>
            </section>

            <WorkProjectResources
              workspaceId={workspaceId}
              workProjectId={workProjectId}
              editable={editable}
            />

            <WorkProjectUpdates
              workspaceId={workspaceId}
              workProjectId={workProjectId}
              editable={canUpdateTasks()}
            />

            <Textarea
              value={description}
              readOnly={!editable}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (project.description ?? "") &&
                save({ description: description.trim() || null })
              }
              placeholder={t(
                "workspace:workProject.detail.descriptionPlaceholder",
              )}
              aria-label={t(
                "workspace:workProject.detail.descriptionPlaceholder",
              )}
              className="min-h-32"
            />

            <WorkProjectMilestones
              workProjectId={workProjectId}
              milestones={project.milestones}
            />

            {editable && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (
                    !window.confirm(
                      t("workspace:workProject.detail.deleteConfirmTitle"),
                    )
                  )
                    return;
                  await remove(workProjectId);
                  toast.success(t("workspace:workProject.detail.deleted"));
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/work-projects",
                    params: { workspaceId },
                  });
                }}
              >
                {t("workspace:workProject.detail.delete")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
