import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { REVIEWS_COUNT_OPTIONS, toggleCountOption } from "@/lib/reviews-count";
import { useUserPreferencesStore } from "@/store/user-preferences";

/** Linear's "Badge count" multi-select; the sidebar's Badge > Include in count edits the same setting. */
export function ReviewsBadgeCountMenu() {
  const { t } = useTranslation();
  const selected = useUserPreferencesStore(
    (state) => state.sidebar.reviewsCount,
  );
  const setSelected = useUserPreferencesStore(
    (state) => state.setSidebarReviewsCount,
  );
  const label = t("workspace:reviews.display.badgeCount");
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="w-40 justify-between font-normal"
              aria-label={label}
            />
          }
        >
          <span className="truncate">
            {t("workspace:reviews.display.badgeCountSelected", {
              count: selected.length,
            })}
          </span>
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {REVIEWS_COUNT_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={() =>
                setSelected(toggleCountOption(selected, option))
              }
            >
              {t(`workspace:reviews.badgeCount.${option}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
