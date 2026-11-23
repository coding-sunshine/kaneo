import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DisplayMenu } from "@/components/project/display/display-menu";
import { DisplaySection } from "@/components/project/display/display-section";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewsBadgeCountMenu } from "@/components/reviews/reviews-badge-count-menu";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import type { ClosedWindow } from "@/fetchers/github-reviews/github-reviews";
import {
  CLOSED_WINDOWS,
  DEFAULT_SORT_DIRECTION,
  REVIEWS_GROUP_BYS,
  REVIEWS_PROPERTIES,
  REVIEWS_SORT_BYS,
  type ReviewsGroupBy,
  type ReviewsSortBy,
  type ReviewsTab,
  type ReviewsView,
} from "@/lib/reviews-view";

type Props = {
  tab: ReviewsTab;
  view: ReviewsView;
  onChange: (patch: Partial<ReviewsView>) => void;
};

export function ReviewsDisplayOptions({ tab, view, onChange }: Props) {
  const { t } = useTranslation();
  const groups = REVIEWS_GROUP_BYS[tab];

  const selectRow = <T extends string>(
    label: string,
    value: T,
    options: readonly T[],
    optionLabel: (option: T) => string,
    onValueChange: (next: T) => void,
    trailing?: React.ReactNode,
  ) => (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm">{label}</span>
      <Select
        value={value}
        onValueChange={(next) => next && onValueChange(next as T)}
      >
        <SelectTrigger size="sm" className="w-40" aria-label={label}>
          <SelectValue>{optionLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {optionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {trailing}
    </div>
  );

  const groupLabel = (by: ReviewsGroupBy) =>
    t(`workspace:reviews.groupBy.${by}`);
  const directionLabel =
    view.sortDirection === "asc"
      ? t("tasks:sort.ascending")
      : t("tasks:sort.descending");

  return (
    <DisplayMenu>
      <DisplaySection>
        <div className="flex flex-col gap-2">
          {selectRow(
            t("workspace:reviews.display.grouping"),
            view.groupBy,
            groups,
            groupLabel,
            (groupBy) =>
              onChange({
                groupBy,
                subGroupBy:
                  view.subGroupBy === groupBy ? "none" : view.subGroupBy,
              }),
          )}
          {selectRow(
            t("workspace:reviews.display.subGrouping"),
            view.subGroupBy,
            groups.filter(
              (option) => option === "none" || option !== view.groupBy,
            ),
            groupLabel,
            (subGroupBy) => onChange({ subGroupBy }),
          )}
          {selectRow(
            t("workspace:reviews.display.ordering"),
            view.sortBy,
            REVIEWS_SORT_BYS,
            (by: ReviewsSortBy) => t(`workspace:reviews.sortBy.${by}`),
            (sortBy) =>
              onChange({
                sortBy,
                sortDirection: DEFAULT_SORT_DIRECTION[sortBy],
              }),
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`${t("tasks:sort.direction")}: ${directionLabel}`}
              title={directionLabel}
              onClick={() =>
                onChange({
                  sortDirection: view.sortDirection === "asc" ? "desc" : "asc",
                })
              }
            >
              {view.sortDirection === "asc" ? (
                <ArrowUpNarrowWide />
              ) : (
                <ArrowDownWideNarrow />
              )}
            </Button>,
          )}
        </div>
      </DisplaySection>
      <DisplaySection>
        <div className="flex flex-col gap-3">
          {selectRow(
            t("workspace:reviews.display.closed"),
            view.closed,
            CLOSED_WINDOWS,
            (window: ClosedWindow) => t(`workspace:reviews.closed.${window}`),
            (closed) => onChange({ closed }),
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t("workspace:reviews.display.showDrafts")}
            </span>
            <Switch
              checked={view.showDrafts}
              onCheckedChange={(showDrafts) => onChange({ showDrafts })}
              aria-label={t("workspace:reviews.display.showDrafts")}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t("workspace:reviews.display.showSnoozed")}
            </span>
            <Switch
              checked={view.showSnoozed}
              onCheckedChange={(showSnoozed) => onChange({ showSnoozed })}
              aria-label={t("workspace:reviews.display.showSnoozed")}
            />
          </div>
          <ReviewsBadgeCountMenu />
        </div>
      </DisplaySection>
      <DisplaySection title={t("workspace:reviews.display.properties")}>
        <div className="flex flex-wrap gap-1.5">
          {REVIEWS_PROPERTIES.map((property) => (
            <Toggle
              key={property}
              variant="outline"
              size="sm"
              pressed={view.properties.includes(property)}
              onPressedChange={(pressed) =>
                onChange({
                  properties: pressed
                    ? [...view.properties, property]
                    : view.properties.filter((entry) => entry !== property),
                })
              }
              className="px-2.5 text-xs text-muted-foreground data-pressed:text-foreground"
            >
              {t(`workspace:reviews.property.${property}`)}
            </Toggle>
          ))}
        </div>
      </DisplaySection>
    </DisplayMenu>
  );
}
