import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortConfig } from "@/lib/sort-tasks";
import { Switch } from "@/components/ui/switch";
import useProjectStore from "@/store/project";
import { columnKey, useUserPreferencesStore } from "@/store/user-preferences";
import type { CompletedIssues } from "@/lib/status-category";
import {
  GROUP_BY_OPTIONS,
  type GroupBy,
  SUB_GROUP_BY_OPTIONS,
} from "@/lib/group-project";
import { CardFieldToggles } from "./card-field-toggles";
import { CustomFieldToggles } from "./custom-field-toggles";
import { DisplaySection } from "./display-section";
import { ProjectBackgroundSwitch } from "./project-background-switch";
import { DEFAULT_SORT } from "@/hooks/use-board-sort";
import { SortOrderControl } from "./sort-order-control";

const COMPLETED_OPTIONS: CompletedIssues[] = ["all", "week", "month", "none"];

type TaskDisplayOptionsProps = {
  projectId: string;
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  layout: "cards" | "rows";
  showBackgroundSwitch?: boolean;
};

export function TaskDisplayOptions({
  projectId,
  sort,
  onSortChange,
  layout,
  showBackgroundSwitch = false,
}: TaskDisplayOptionsProps) {
  const { t } = useTranslation();
  const groupBy = useUserPreferencesStore((state) => state.listGroupBy);
  const setGroupBy = useUserPreferencesStore((state) => state.setListGroupBy);
  const subGroupBy = useUserPreferencesStore((state) => state.listSubGroupBy);
  const setSubGroupBy = useUserPreferencesStore(
    (state) => state.setListSubGroupBy,
  );
  const resetDisplayPreferences = useUserPreferencesStore(
    (state) => state.resetDisplayPreferences,
  );

  const showEmptyColumns = useUserPreferencesStore(
    (state) => state.showEmptyColumns,
  );
  const setShowEmptyColumns = useUserPreferencesStore(
    (state) => state.setShowEmptyColumns,
  );

  const completedIssues = useUserPreferencesStore((s) => s.completedIssues);
  const setCompletedIssues = useUserPreferencesStore(
    (s) => s.setCompletedIssues,
  );

  const orderByRecency = useUserPreferencesStore(
    (s) => s.orderCompletedByRecency,
  );
  const setOrderByRecency = useUserPreferencesStore(
    (s) => s.setOrderCompletedByRecency,
  );

  const showSubIssues = useUserPreferencesStore((s) => s.showSubIssues);
  const setShowSubIssues = useUserPreferencesStore((s) => s.setShowSubIssues);
  const showTriageIssues = useUserPreferencesStore((s) => s.showTriageIssues);
  const setShowTriageIssues = useUserPreferencesStore(
    (s) => s.setShowTriageIssues,
  );

  const hiddenColumnIds = useUserPreferencesStore(
    (state) => state.hiddenColumnIds,
  );
  const toggleColumnHidden = useUserPreferencesStore(
    (state) => state.toggleColumnHidden,
  );
  const columns = useProjectStore((state) => state.project?.columns);
  const hiddenColumns = columns?.filter((c) =>
    hiddenColumnIds.includes(columnKey(projectId, c.id)),
  );

  return (
    <>
      {layout === "cards" && hiddenColumns && hiddenColumns.length > 0 && (
        <DisplaySection title={t("tasks:display.hiddenColumns")}>
          <div className="flex flex-col gap-1">
            {hiddenColumns.map((column) => (
              <div
                key={column.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="truncate text-sm">{column.name}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    toggleColumnHidden(columnKey(projectId, column.id))
                  }
                >
                  {t("tasks:display.showColumn")}
                </Button>
              </div>
            ))}
          </div>
        </DisplaySection>
      )}
      <DisplaySection>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm">
            {t("tasks:display.completedIssues")}
          </span>
          <Select
            value={completedIssues}
            onValueChange={(value) =>
              value && setCompletedIssues(value as CompletedIssues)
            }
          >
            <SelectTrigger
              size="sm"
              className="w-40"
              aria-label={t("tasks:display.completedIssues")}
            >
              <SelectValue>
                {t(`tasks:display.completed.${completedIssues}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPLETED_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`tasks:display.completed.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </DisplaySection>
      <DisplaySection>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">{t("tasks:display.showSubIssues")}</span>
            <Switch
              checked={showSubIssues}
              onCheckedChange={setShowSubIssues}
              aria-label={t("tasks:display.showSubIssues")}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t("tasks:display.orderCompletedByRecency")}
            </span>
            <Switch
              checked={orderByRecency}
              onCheckedChange={setOrderByRecency}
              aria-label={t("tasks:display.orderCompletedByRecency")}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t("tasks:display.showTriageIssues")}
            </span>
            <Switch
              checked={showTriageIssues}
              onCheckedChange={setShowTriageIssues}
              aria-label={t("tasks:display.showTriageIssues")}
            />
          </div>
        </div>
      </DisplaySection>
      {layout === "cards" && (
        <DisplaySection>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t("tasks:display.showEmptyColumns")}
            </span>
            <Switch
              checked={showEmptyColumns}
              onCheckedChange={setShowEmptyColumns}
              aria-label={t("tasks:display.showEmptyColumns")}
            />
          </div>
        </DisplaySection>
      )}
      {layout === "rows" && (
        <DisplaySection>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm">
              {t("tasks:display.grouping")}
            </span>
            <Select
              value={groupBy}
              onValueChange={(value) => value && setGroupBy(value as GroupBy)}
            >
              <SelectTrigger
                size="sm"
                className="w-40"
                aria-label={t("tasks:display.grouping")}
              >
                <SelectValue>
                  {t(`tasks:display.groupBy.${groupBy}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`tasks:display.groupBy.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DisplaySection>
      )}
      {layout === "rows" && groupBy !== "status" && groupBy !== "none" && (
        <DisplaySection>
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm">
              {t("tasks:display.subGrouping")}
            </span>
            <Select
              value={subGroupBy}
              onValueChange={(value) =>
                value && setSubGroupBy(value as GroupBy)
              }
            >
              <SelectTrigger
                size="sm"
                className="w-40"
                aria-label={t("tasks:display.subGrouping")}
              >
                <SelectValue>
                  {t(`tasks:display.groupBy.${subGroupBy}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SUB_GROUP_BY_OPTIONS.filter(
                  (option) => option !== groupBy,
                ).map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`tasks:display.groupBy.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DisplaySection>
      )}
      <DisplaySection>
        <SortOrderControl sort={sort} onSortChange={onSortChange} />
      </DisplaySection>
      <DisplaySection
        title={
          layout === "cards"
            ? t("tasks:display.showOnCards")
            : t("tasks:display.showOnRows")
        }
      >
        <div className="flex flex-col gap-3">
          <CardFieldToggles />
          <CustomFieldToggles projectId={projectId} />
        </div>
      </DisplaySection>
      {showBackgroundSwitch && (
        <DisplaySection>
          <ProjectBackgroundSwitch />
        </DisplaySection>
      )}
      <div className="flex justify-end px-2 py-1.5">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            resetDisplayPreferences();
            onSortChange(DEFAULT_SORT);
          }}
        >
          {t("common:actions.reset")}
        </Button>
      </div>
    </>
  );
}
