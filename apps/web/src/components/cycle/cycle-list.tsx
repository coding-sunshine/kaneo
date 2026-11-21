import { Link } from "@tanstack/react-router";
import { CirclePlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { Cycle } from "@/fetchers/cycle/get-cycles";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { cn } from "@/lib/cn";
import { cycleDay, cycleState, cycleTitle } from "@/lib/cycle/cycle-label";
import { ProgressRing, useStateLabels } from "./cycle-state";

type Props = { workspaceId: string; projectId: string };

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function CycleRow({
  cycle,
  workspaceId,
  projectId,
  isFirstUpcoming,
}: {
  cycle: Cycle;
  workspaceId: string;
  projectId: string;
  isFirstUpcoming: boolean;
}) {
  const { t } = useTranslation();
  const labels = useStateLabels();
  const state = cycleState(cycle);
  const { total, started, done } = cycle.progress;
  const day = cycleDay(cycle.startsAt);
  const badge =
    state === "upcoming" && !isFirstUpcoming ? labels.planned : labels[state];
  const value =
    state === "previous" ? pct(done, total) : pct(done + started, total);

  return (
    <div className="relative flex gap-4 pl-2">
      <div className="flex w-10 shrink-0 flex-col items-end pt-3 text-right text-muted-foreground text-xs leading-tight">
        <span>{day.month}</span>
        <span>{day.day}</span>
      </div>
      <span
        className="absolute top-0 bottom-0 left-14 w-px bg-border"
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-4 left-[3.45rem] size-1.5 rounded-full",
          state === "current" ? "bg-primary" : "bg-muted-foreground/60",
        )}
        aria-hidden
      />
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/cycle/$cycleId"
        params={{ workspaceId, projectId, cycleId: cycle.id }}
        data-cycle-row={cycle.number}
        className="my-1 ml-4 flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 outline-none hover:bg-accent focus-visible:bg-accent"
      >
        <CirclePlay className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-[13px]">{cycleTitle(cycle)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
          {badge}
        </span>
        <span className="ml-auto flex items-center gap-4 text-muted-foreground text-xs tabular-nums">
          <span className="flex w-36 items-center gap-1.5">
            <ProgressRing value={value / 100} />
            {state === "previous"
              ? t("workspace:cycles.percentSuccess", { percent: value })
              : t("workspace:cycles.percentCapacity", { percent: value })}
          </span>
          <span className="w-24 text-right">
            {state === "previous"
              ? t("workspace:cycles.completedCount", { count: done })
              : ""}
          </span>
          <span className="w-20 text-right">
            {t("workspace:cycles.scopeCount", { count: total })}
          </span>
        </span>
      </Link>
    </div>
  );
}

export function CycleList({ workspaceId, projectId }: Props) {
  const { t } = useTranslation();
  const { data: cycles, isLoading } = useGetCycles(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (!cycles?.length) {
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CirclePlay />
          </EmptyMedia>
          <EmptyTitle>{t("workspace:cycles.empty")}</EmptyTitle>
          <EmptyDescription>
            {t("workspace:cycles.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const firstUpcoming = [...cycles]
    .filter((c) => cycleState(c) === "upcoming")
    .sort((a, b) => a.number - b.number)[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col py-4">
      {cycles.map((cycle) => (
        <CycleRow
          key={cycle.id}
          cycle={cycle}
          workspaceId={workspaceId}
          projectId={projectId}
          isFirstUpcoming={cycle.id === firstUpcoming?.id}
        />
      ))}
    </div>
  );
}
