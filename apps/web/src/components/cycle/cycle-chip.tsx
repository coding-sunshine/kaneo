import { Link } from "@tanstack/react-router";
import { CirclePlay } from "lucide-react";
import { stopCardEvents } from "@/components/task-chips/stop-card-events";
import { taskChipClass } from "@/components/task-chips/task-chip-class";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { cn } from "@/lib/cn";
import { cycleTitle } from "@/lib/cycle/cycle-label";

type Props = {
  cycleId: string | null | undefined;
  projectId: string;
  workspaceId: string;
  className?: string;
};

/** Cycle icon + "Cycle N", shown on cards and rows when the issue has a cycle. */
export function CycleChip({
  cycleId,
  projectId,
  workspaceId,
  className,
}: Props) {
  const { data } = useGetCycles(cycleId ? projectId : "");
  const cycle = cycleId ? data?.find((c) => c.id === cycleId) : undefined;
  if (!cycle || !workspaceId) return null;

  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/cycle/$cycleId"
      params={{ workspaceId, projectId, cycleId: cycle.id }}
      title={cycleTitle(cycle)}
      className={cn(taskChipClass, "max-w-36 gap-1.5", className)}
      {...stopCardEvents}
    >
      <CirclePlay />
      <span className="truncate">{cycleTitle(cycle)}</span>
    </Link>
  );
}
