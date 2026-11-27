import { Link } from "@tanstack/react-router";
import { startOfWeek } from "date-fns";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import useGetDoneTasks from "@/hooks/queries/task/use-get-done-tasks";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { SectionHeader } from "./section-header";

type DoneThisWeekProps = {
  workspaceId: string;
  day: number;
};

// Private to the caller and deliberately uncounted: a quiet record, not a score.
export function DoneThisWeek({ workspaceId, day }: DoneThisWeekProps) {
  const { t } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const since = startOfWeek(new Date(day), { weekStartsOn }).toISOString();
  const { data, isLoading, isError } = useGetDoneTasks(workspaceId, since);
  const title = t("workspace:home.doneThisWeek.title");

  return (
    <section aria-label={title}>
      <SectionHeader title={title} />

      {isLoading ? (
        <div className="delayed-reveal flex flex-col">
          {[1, 2].map((row) => (
            <div
              key={row}
              className="flex h-10 items-center gap-3 border-border/50 border-b px-1"
            >
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : isError && !data ? (
        <p role="alert" className="py-6 text-muted-foreground text-sm">
          {t("workspace:myWork.loadError")}
        </p>
      ) : !data?.tasks.length ? (
        <p className="py-6 text-muted-foreground text-sm">
          {t("workspace:home.doneThisWeek.empty")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {data.tasks.map((task) => (
            <li key={task.id}>
              <Link
                to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                params={{
                  workspaceId,
                  projectId: task.projectId,
                  taskId: task.id,
                }}
                className="flex h-10 items-center gap-2.5 border-border/50 border-b px-1 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
              >
                <span className="min-w-0 flex-1 truncate text-foreground text-sm">
                  {task.title}
                </span>
                <span className="hidden w-28 shrink-0 truncate text-muted-foreground text-xs sm:block">
                  {task.projectName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
