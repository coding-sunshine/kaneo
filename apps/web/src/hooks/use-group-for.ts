import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Cycle } from "@/fetchers/cycle/get-cycles";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { cycleTitle } from "@/lib/cycle/cycle-label";
import { groupProjectBy } from "@/lib/group-project";
import type { GroupFn } from "@/lib/insights/compute-insights";

/** Groups issues with the list view's names for projects and cycles. */
export function useGroupFor(
  workspaceId: string,
  cycles: Pick<Cycle, "id" | "number" | "name">[] | undefined,
): GroupFn {
  const { t } = useTranslation();
  const { data: workProjects } = useGetWorkProjects(workspaceId);
  return useCallback<GroupFn>(
    (source, by) =>
      groupProjectBy(
        source,
        by,
        (key) =>
          key === "display.unassigned"
            ? t("tasks:display.noAssignee")
            : t(`tasks:${key}`),
        (id) => workProjects?.find((item) => item.id === id)?.name,
        (id) => {
          const c = cycles?.find((item) => item.id === id);
          return c ? cycleTitle(c) : undefined;
        },
      ),
    [t, workProjects, cycles],
  );
}
