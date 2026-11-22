import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  REVIEWS_GROUP_BYS,
  REVIEWS_SORT_BYS,
  type ReviewsGroupBy,
  type ReviewsSortBy,
  type ReviewsView,
} from "@/lib/reviews-view";

type Props = {
  view: ReviewsView;
  onChange: (patch: Partial<ReviewsView>) => void;
};

export function ReviewsDisplayOptions({ view, onChange }: Props) {
  const { t } = useTranslation();
  const groupLabel = (by: ReviewsGroupBy) =>
    t(`workspace:reviews.groupBy.${by}`);

  const picker = (
    label: string,
    value: ReviewsGroupBy,
    onValueChange: (next: ReviewsGroupBy) => void,
    options: ReviewsGroupBy[],
  ) => (
    <MenuSub>
      <MenuSubTrigger>
        {label}
        <span className="ms-auto text-muted-foreground text-xs">
          {groupLabel(value)}
        </span>
      </MenuSubTrigger>
      <MenuSubPopup>
        <MenuRadioGroup
          value={value}
          onValueChange={(next) => onValueChange(next as ReviewsGroupBy)}
        >
          {options.map((option) => (
            <MenuRadioItem key={option} value={option}>
              {groupLabel(option)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuSubPopup>
    </MenuSub>
  );

  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="icon-xs" />}
        title={t("workspace:reviews.display.label")}
      >
        <SlidersHorizontal />
        <span className="sr-only">{t("workspace:reviews.display.label")}</span>
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-56">
        {picker(
          t("workspace:reviews.display.grouping"),
          view.groupBy,
          (groupBy) => onChange({ groupBy, pinned: [] }),
          REVIEWS_GROUP_BYS,
        )}
        {picker(
          t("workspace:reviews.display.subGrouping"),
          view.subGroupBy,
          (subGroupBy) => onChange({ subGroupBy }),
          REVIEWS_GROUP_BYS.filter((by) => by !== view.groupBy),
        )}
        <MenuSub>
          <MenuSubTrigger>
            {t("workspace:reviews.display.ordering")}
            <span className="ms-auto text-muted-foreground text-xs">
              {t(`workspace:reviews.sortBy.${view.sortBy}`)}
            </span>
          </MenuSubTrigger>
          <MenuSubPopup>
            <MenuRadioGroup
              value={view.sortBy}
              onValueChange={(next) =>
                onChange({ sortBy: next as ReviewsSortBy })
              }
            >
              {REVIEWS_SORT_BYS.map((option) => (
                <MenuRadioItem key={option} value={option}>
                  {t(`workspace:reviews.sortBy.${option}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubPopup>
        </MenuSub>
        <MenuSeparator />
        <MenuCheckboxItem
          checked={view.showRepository}
          onCheckedChange={(showRepository) => onChange({ showRepository })}
        >
          {t("workspace:reviews.display.repository")}
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={view.showChecks}
          onCheckedChange={(showChecks) => onChange({ showChecks })}
        >
          {t("workspace:reviews.display.checks")}
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={view.showSize}
          onCheckedChange={(showSize) => onChange({ showSize })}
        >
          {t("workspace:reviews.display.size")}
        </MenuCheckboxItem>
      </MenuPopup>
    </Menu>
  );
}
