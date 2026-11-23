import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DiffLayout } from "@/components/reviews/patch-diff";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

export type DiffOptions = {
  layout: DiffLayout;
  wrap: boolean;
  showCounts: boolean;
  hideReviewed: boolean;
};

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  layout: "unified",
  wrap: false,
  showCounts: true,
  hideReviewed: false,
};

const toggles = ["wrap", "showCounts", "hideReviewed"] as const;

/** Linear's sliders menu, with the options Kaneo can back. */
export function DiffOptionsMenu({
  options,
  onChange,
  canSplit,
}: {
  options: DiffOptions;
  onChange: (patch: Partial<DiffOptions>) => void;
  /** Split needs room; narrow screens read unified only. */
  canSplit: boolean;
}) {
  const { t } = useTranslation();
  const title = t("workspace:reviews.detail.options.title");
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={title}
            className="data-popup-open:bg-accent"
          />
        }
      >
        <SlidersHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <div className="flex flex-col gap-3 p-1">
          {canSplit && (
            <div role="group" className="grid grid-cols-2 gap-1.5">
              {(["split", "unified"] as const).map((value) => (
                <Button
                  key={value}
                  size="xs"
                  variant="outline"
                  aria-pressed={options.layout === value}
                  onClick={() => onChange({ layout: value })}
                  className={
                    options.layout === value
                      ? "bg-accent"
                      : "text-muted-foreground"
                  }
                >
                  {t(`workspace:reviews.detail.layout.${value}`)}
                </Button>
              ))}
            </div>
          )}
          {toggles.map((name) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {t(`workspace:reviews.detail.options.${name}`)}
              </span>
              <Switch
                checked={options[name]}
                onCheckedChange={(checked) => onChange({ [name]: checked })}
              />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
