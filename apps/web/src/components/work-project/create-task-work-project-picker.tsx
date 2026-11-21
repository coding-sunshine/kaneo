import { Box, Milestone, Minus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetWorkProject } from "@/hooks/queries/work-project/use-get-work-project";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { cn } from "@/lib/cn";
import { WorkProjectIcon } from "./work-project-icon";

const NONE = "__none__";
const pillClass =
  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50";

type Props = {
  workspaceId: string;
  workProjectId: string | null;
  milestoneId: string | null;
  onChange: (workProjectId: string | null, milestoneId: string | null) => void;
};

/** Project pill, plus a milestone pill once a project is chosen. */
export function CreateTaskWorkProjectPicker({
  workspaceId,
  workProjectId,
  milestoneId,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const [projectOpen, setProjectOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const { data: projects = [] } = useGetWorkProjects(workspaceId);
  const { data: detail } = useGetWorkProject(workProjectId ?? "");
  const project = projects.find((p) => p.id === workProjectId);
  const milestone = detail?.milestones.find((m) => m.id === milestoneId);

  return (
    <>
      <Popover open={projectOpen} onOpenChange={setProjectOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              pillClass,
              project
                ? "bg-accent/30 text-foreground"
                : "text-muted-foreground",
            )}
          >
            {project ? (
              <WorkProjectIcon icon={project.icon} color={project.color} />
            ) : (
              <Box className="size-3.5" />
            )}
            <span>{project?.name ?? t("tasks:createModal.project")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0" align="start">
          <OptionMenu
            label={t("tasks:createModal.project")}
            placeholder={t("tasks:popover.workProject.placeholder")}
            options={[
              {
                value: NONE,
                label: t("tasks:popover.workProject.none"),
                icon: <Minus className="size-3.5 text-muted-foreground" />,
                selected: !workProjectId,
                pinned: true,
              },
              ...projects.map((p) => ({
                value: p.id,
                label: p.name,
                icon: <WorkProjectIcon icon={p.icon} color={p.color} />,
                selected: p.id === workProjectId,
              })),
            ]}
            onSelect={(v) => {
              setProjectOpen(false);
              const next = v === NONE ? null : v;
              if (next !== workProjectId) onChange(next, null);
            }}
          />
        </PopoverContent>
      </Popover>
      {workProjectId && (
        <Popover open={milestoneOpen} onOpenChange={setMilestoneOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                pillClass,
                milestone
                  ? "bg-accent/30 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Milestone className="size-3.5" />
              <span>{milestone?.name ?? t("tasks:createModal.milestone")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-0" align="start">
            <OptionMenu
              label={t("tasks:createModal.milestone")}
              placeholder={t("tasks:popover.milestone.placeholder")}
              options={[
                {
                  value: NONE,
                  label: t("tasks:popover.milestone.none"),
                  icon: <Minus className="size-3.5 text-muted-foreground" />,
                  selected: !milestoneId,
                  pinned: true,
                },
                ...(detail?.milestones ?? []).map((m) => ({
                  value: m.id,
                  label: m.name,
                  icon: (
                    <Milestone className="size-3.5 text-muted-foreground" />
                  ),
                  selected: m.id === milestoneId,
                })),
              ]}
              onSelect={(v) => {
                setMilestoneOpen(false);
                onChange(workProjectId, v === NONE ? null : v);
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
