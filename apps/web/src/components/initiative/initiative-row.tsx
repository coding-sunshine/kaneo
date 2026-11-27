import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { WorkProjectHealth } from "@/components/work-project/work-project-health";
import type { Initiative } from "@/fetchers/initiative/types";
import { formatDateShort } from "@/lib/format";
import { progressPercent } from "@/lib/work-project/progress";

type Props = {
  initiative: Initiative;
  workspaceId: string;
  ownerName: string | undefined;
};

export function InitiativeRow({ initiative, workspaceId, ownerName }: Props) {
  const { t } = useTranslation();
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/initiatives/$initiativeId"
      params={{ workspaceId, initiativeId: initiative.id }}
      className="grid h-12 grid-cols-[minmax(0,1fr)_9rem_9rem_7rem_6rem] items-center gap-4 border-border/40 border-b px-6 text-[13px] outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <span className="truncate font-medium">{initiative.name}</span>
      <WorkProjectHealth health={initiative.rolledUpHealth} />
      <span className="truncate text-muted-foreground">
        {ownerName ?? t("workspace:initiative.fields.noOwner")}
      </span>
      <span className="text-muted-foreground">
        {initiative.targetDate
          ? formatDateShort(initiative.targetDate)
          : t("workspace:workProject.noDate")}
      </span>
      <span className="text-right text-muted-foreground tabular-nums">
        {t("workspace:initiative.list.projects", {
          count: initiative.workProjectIds.length,
        })}{" "}
        · {progressPercent(initiative.progress)}%
      </span>
    </Link>
  );
}
