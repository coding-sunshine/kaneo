import { CirclePlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Cycle } from "@/fetchers/cycle/get-cycles";
import { cycleRange, cycleState, cycleTitle } from "@/lib/cycle/cycle-label";
import type { ProjectWithTasks } from "@/types/project";
import { useStateLabels } from "./cycle-state";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function Stat({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of: number;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {value}{" "}
        <span className="text-muted-foreground">• {pct(value, of)}%</span>
      </span>
    </div>
  );
}

type Props = { cycle: Cycle; board: ProjectWithTasks | undefined };

/** Right-hand details panel of the cycle page. */
export function CycleSidePanel({ cycle, board }: Props) {
  const { t } = useTranslation();
  const labels = useStateLabels();
  const { total, started, done } = cycle.progress;

  const tasks = (board?.columns ?? []).flatMap((c) =>
    c.tasks.filter((task) => task.cycleId === cycle.id),
  );
  const byAssignee = new Map<
    string,
    { name: string; all: number; done: number }
  >();
  for (const task of tasks) {
    if (task.status === "canceled") continue;
    const key = task.userId ?? "none";
    const row = byAssignee.get(key) ?? {
      name: task.assigneeName ?? t("tasks:display.noAssignee"),
      all: 0,
      done: 0,
    };
    row.all += 1;
    if (task.status === "done") row.done += 1;
    byAssignee.set(key, row);
  }

  return (
    <aside
      aria-label={t("workspace:cycles.details")}
      data-cycle-panel
      className="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-border/80 border-l p-4 lg:flex"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-border px-1.5 py-0.5">
          {labels[cycleState(cycle)]}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
          {cycleRange(cycle)}
        </span>
      </div>
      <div className="flex items-center gap-2 font-medium text-base">
        <CirclePlay className="size-4 text-muted-foreground" />
        {cycleTitle(cycle)}
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-[13px]">
          {t("workspace:cycles.progress")}
        </h3>
        <Stat label={t("workspace:cycles.scope")} value={total} of={total} />
        <Stat
          label={t("workspace:cycles.started")}
          value={started}
          of={total}
        />
        <Stat label={t("workspace:cycles.completed")} value={done} of={total} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-medium text-[13px]">
          {t("workspace:cycles.assignees")}
        </h3>
        {[...byAssignee.values()].map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between text-[13px]"
          >
            <span className="truncate">{row.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {t("workspace:cycles.percentOf", {
                percent: pct(row.done, row.all),
                count: row.all,
              })}
            </span>
          </div>
        ))}
      </section>
    </aside>
  );
}
