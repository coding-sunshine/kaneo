import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { GROUP_BY_OPTIONS, type GroupBy } from "@/lib/group-project";
import {
  computeInsights,
  type GroupFn,
  INSIGHT_MEASURES,
  type InsightMeasure,
} from "@/lib/insights/compute-insights";
import {
  BURN_UP_INTERVALS,
  type BurnUpInterval,
  computeBurnUp,
} from "@/lib/insights/compute-burn-up";
import { withArchived } from "@/lib/insights/with-archived";
import { effortWeight, viewUsesEstimates } from "@/lib/insights/effort-weight";
import {
  type InsightSelection,
  selectedIssueIds,
  toggleSelection,
} from "@/lib/insights/insight-selection";
import { useInsightsSelectionStore } from "@/store/insights-selection";
import type { ProjectWithTasks } from "@/types/project";
import { InsightsBarChart } from "./insights-bar-chart";
import { InsightsBurnUp } from "./insights-burn-up";
import { InsightsScatter } from "./insights-scatter";
import { InsightsTable } from "./insights-table";
import { segmentColor } from "./segment-color";

type InsightsPanelProps = {
  /** The issues currently in view, after filters. */
  project: ProjectWithTasks;
  group: GroupFn;
};

type SliceOption = GroupBy | "burnUp";
const SLICE_OPTIONS: SliceOption[] = [
  ...GROUP_BY_OPTIONS.filter((option) => option !== "none"),
  "burnUp",
];

/** Linear's Insights panel: a measure over the view's issues, sliced and segmented. */
export function InsightsPanel({ project: source, group }: InsightsPanelProps) {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const project = useMemo(
    () => (showArchived ? withArchived(source) : source),
    [source, showArchived],
  );
  const [picked, setMeasure] = useState<InsightMeasure>("count");
  const { data: workspace } = useActiveWorkspace();
  const { data: teams = [] } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });
  const [slice, setSlice] = useState<SliceOption>("status");
  const [segment, setSegment] = useState<GroupBy>("none");
  const [interval, setInterval] = useState<BurnUpInterval>("month");
  const [selection, setSelection] = useState<InsightSelection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const burnUp = slice === "burnUp";
  const measures = useMemo(() => {
    const teamIds = new Set([project.id]);
    for (const column of project.columns)
      for (const task of column.tasks) teamIds.add(task.projectId);
    return viewUsesEstimates(teams, teamIds)
      ? INSIGHT_MEASURES
      : INSIGHT_MEASURES.filter((option) => option !== "effort");
  }, [project, teams]);
  const measure = measures.includes(picked) ? picked : "count";
  const weight = useMemo(() => effortWeight(teams), [teams]);
  const insights = useMemo(
    () =>
      computeInsights(
        project,
        measure,
        burnUp ? "status" : slice,
        segment,
        group,
        undefined,
        weight,
      ),
    [project, measure, slice, burnUp, segment, group, weight],
  );
  const buckets = useMemo(
    () => (burnUp ? computeBurnUp(project, interval) : []),
    [project, burnUp, interval],
  );
  const groupLabel = (option: SliceOption) =>
    option === "none"
      ? t("tasks:insights.noSegment")
      : option === "burnUp"
        ? t("tasks:insights.burnUp")
        : t(`tasks:display.groupBy.${option}`);

  // Picking a bar, row, column or cell filters the issue view until cleared.
  const setIds = useInsightsSelectionStore((state) => state.setIds);
  const ids = useMemo(
    () => (burnUp ? null : selectedIssueIds(insights, selection)),
    [insights, selection, burnUp],
  );
  useEffect(() => setIds(ids?.size ? ids : null), [ids, setIds]);
  useEffect(() => () => setIds(null), [setIds]);
  useEffect(() => {
    if (!selection) return;
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setSelection(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selection]);
  const select = (next: InsightSelection) =>
    setSelection((current) => toggleSelection(current, next));
  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setSelection(null);
      set(value);
    };

  const picker = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    optionLabel: (option: T) => string,
    onChange: (value: T) => void,
  ) => (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-muted-foreground text-xs">
        {label}
      </span>
      <Select
        value={value}
        onValueChange={(next) => next && onChange(next as T)}
      >
        <SelectTrigger size="sm" className="flex-1" aria-label={label}>
          <SelectValue>{optionLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {optionLabel(option)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );

  return (
    <aside
      aria-label={t("tasks:insights.title")}
      className="hidden w-96 shrink-0 flex-col gap-4 overflow-y-auto border-border/80 border-l p-4 md:flex"
    >
      <h2 className="font-medium text-[13px]">{t("tasks:insights.title")}</h2>
      <div className="flex flex-col gap-1.5">
        {!burnUp &&
          picker(
            t("tasks:insights.measure"),
            measure,
            measures,
            (option) => t(`tasks:insights.measures.${option}`),
            reset(setMeasure),
          )}
        {picker(
          t("tasks:insights.slice"),
          slice,
          SLICE_OPTIONS,
          groupLabel,
          reset(setSlice),
        )}
        {burnUp
          ? picker(
              t("tasks:insights.interval"),
              interval,
              BURN_UP_INTERVALS,
              (option) => t(`tasks:insights.intervals.${option}`),
              setInterval,
            )
          : picker(
              t("tasks:insights.segment"),
              segment,
              GROUP_BY_OPTIONS,
              groupLabel,
              reset(setSegment),
            )}
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={showArchived}
            onCheckedChange={reset(setShowArchived)}
            aria-label={t("tasks:insights.showArchived")}
          />
          {t("tasks:insights.showArchived")}
        </label>
      </div>

      {insights.issueCount === 0 || (burnUp && buckets.length === 0) ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          {t("tasks:insights.empty")}
        </p>
      ) : burnUp ? (
        <InsightsBurnUp buckets={buckets} interval={interval} />
      ) : (
        <>
          <figure
            aria-label={t("tasks:insights.chartLabel", {
              measure: t(`tasks:insights.measures.${measure}`),
              slice: groupLabel(slice),
            })}
            className="flex flex-col gap-2"
          >
            {measure === "count" || measure === "effort" ? (
              <InsightsBarChart
                insights={insights}
                segmented={segment !== "none"}
                selection={selection}
                hovered={hovered}
                onHover={setHovered}
                onSelect={select}
              />
            ) : (
              <InsightsScatter
                key={measure}
                insights={insights}
                slug={project.slug}
                segmented={segment !== "none"}
                hovered={hovered}
                onHover={setHovered}
              />
            )}
            {segment !== "none" && (
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
                {insights.segments.map((item, index) => (
                  <li key={item.key} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: segmentColor(index) }}
                    />
                    {item.name}
                  </li>
                ))}
              </ul>
            )}
          </figure>
          <InsightsTable
            insights={insights}
            measure={measure}
            sliceLabel={groupLabel(slice)}
            segmented={segment !== "none"}
            selection={selection}
            hovered={hovered}
            onHover={setHovered}
            onSelect={select}
          />
        </>
      )}
    </aside>
  );
}
