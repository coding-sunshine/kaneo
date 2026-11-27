import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkProjectHealth } from "@/components/work-project/work-project-health";
import type { UpdateInitiativeInput } from "@/fetchers/initiative/types";
import {
  useDeleteInitiative,
  useUpdateInitiative,
} from "@/hooks/mutations/initiative/use-initiative-mutations";
import { useGetInitiative } from "@/hooks/queries/initiative/use-get-initiative";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { progressPercent } from "@/lib/work-project/progress";
import { InitiativeProjects } from "./initiative-projects";
import { InitiativeProperties } from "./initiative-properties";
import { InitiativeUpdates } from "./initiative-updates";

type Props = { workspaceId: string; initiativeId: string };

export function InitiativeDetail({ workspaceId, initiativeId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: initiative, isError } = useGetInitiative(initiativeId);
  const { mutateAsync: update } = useUpdateInitiative(initiativeId);
  const { mutateAsync: remove } = useDeleteInitiative();
  const { canUpdateProjects, canDeleteProjects, canUpdateTasks } =
    useWorkspacePermission();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!initiative) return;
    setName(initiative.name);
    setDescription(initiative.description ?? "");
  }, [initiative]);

  if (isError) {
    return (
      <p role="alert" className="p-6 text-muted-foreground text-sm">
        {t("workspace:initiative.notFound")}
      </p>
    );
  }
  if (!initiative) return null;

  const editable = canUpdateProjects();
  const save = async (patch: UpdateInitiativeInput) => {
    try {
      await update(patch);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("workspace:initiative.detail.updateError"),
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4 text-[13px]">
        <Link
          to="/dashboard/workspace/$workspaceId/initiatives"
          params={{ workspaceId }}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("workspace:initiative.pageTitle")}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{initiative.name}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          <Input
            unstyled
            value={name}
            readOnly={!editable}
            onChange={(e) => setName(e.target.value)}
            onBlur={() =>
              name.trim() &&
              name !== initiative.name &&
              save({ name: name.trim() })
            }
            aria-label={t("workspace:initiative.detail.titleLabel")}
            className="w-full font-semibold text-2xl outline-none"
          />

          <section className="space-y-2">
            <h2 className="font-medium text-sm">
              {t("workspace:initiative.detail.properties")}
            </h2>
            <InitiativeProperties
              workspaceId={workspaceId}
              initiative={initiative}
              editable={editable}
              onChange={save}
            />
            <div className="grid grid-cols-[8rem_1fr] items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">
                {t("workspace:initiative.detail.rolledUpHealth")}
              </span>
              <span
                aria-label={t("workspace:initiative.detail.rolledUpHealth")}
              >
                <WorkProjectHealth health={initiative.rolledUpHealth} />
              </span>
              <span className="text-muted-foreground">
                {t("workspace:initiative.detail.progressLabel")}
              </span>
              <span className="text-muted-foreground">
                {t("workspace:initiative.detail.progress", {
                  done: initiative.progress.done,
                  total: initiative.progress.total,
                })}{" "}
                ({progressPercent(initiative.progress)}%)
              </span>
            </div>
          </section>

          <InitiativeProjects
            workspaceId={workspaceId}
            initiative={initiative}
            editable={editable}
            onChange={(workProjectIds) => save({ workProjectIds })}
          />

          <InitiativeUpdates
            workspaceId={workspaceId}
            initiativeId={initiativeId}
            editable={canUpdateTasks()}
          />

          <Textarea
            value={description}
            readOnly={!editable}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() =>
              description !== (initiative.description ?? "") &&
              save({ description: description.trim() || null })
            }
            placeholder={t(
              "workspace:initiative.detail.descriptionPlaceholder",
            )}
            aria-label={t("workspace:initiative.detail.descriptionPlaceholder")}
            className="min-h-32"
          />

          {canDeleteProjects() && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                if (
                  !window.confirm(
                    t("workspace:initiative.detail.deleteConfirm"),
                  )
                )
                  return;
                await remove(initiativeId);
                toast.success(t("workspace:initiative.detail.deleted"));
                navigate({
                  to: "/dashboard/workspace/$workspaceId/initiatives",
                  params: { workspaceId },
                });
              }}
            >
              {t("workspace:initiative.detail.delete")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
