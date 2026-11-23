import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DiffLayout } from "@/components/reviews/patch-diff";
import { SegmentedOptions } from "@/components/reviews/segmented-options";
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
  structural: boolean;
  fileList: "flat" | "tree";
  group: "none" | "type";
  order: "path" | "changes";
  desc: boolean;
  minimizeGenerated: boolean;
  minimizeTests: boolean;
};

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  layout: "unified",
  wrap: false,
  showCounts: true,
  hideReviewed: false,
  structural: true,
  fileList: "flat",
  group: "none",
  order: "path",
  desc: false,
  minimizeGenerated: true,
  minimizeTests: true,
};

const toggles = [
  "structural",
  "wrap",
  "showCounts",
  "minimizeGenerated",
  "minimizeTests",
  "hideReviewed",
] as const;
const toggleKey = (name: (typeof toggles)[number]) =>
  name === "structural" || name.startsWith("minimize")
    ? `workspace:reviews.diffOptions2.${name}`
    : `workspace:reviews.detail.options.${name}`;

/** Linear's sliders menu, with the options Kaneo can back. */
export function DiffOptionsMenu({
  options,
  onChange,
}: {
  options: DiffOptions;
  onChange: (patch: Partial<DiffOptions>) => void;
}) {
  const { t } = useTranslation();
  const title = t("workspace:reviews.detail.options.title");
  const toggle = (name: (typeof toggles)[number]) => (
    <label key={name} className="flex items-center gap-2 text-sm">
      <span className="flex-1">{t(toggleKey(name))}</span>
      <Switch
        checked={options[name]}
        onCheckedChange={(checked) => onChange({ [name]: checked })}
      />
    </label>
  );
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
          <SegmentedOptions
            values={["split", "unified"] as const}
            value={options.layout}
            text={(value) => t(`workspace:reviews.detail.layout.${value}`)}
            onChange={(layout) => onChange({ layout })}
          />
          {toggles.slice(0, 3).map(toggle)}
          <SegmentedOptions
            title={t("workspace:reviews.diffOptions2.fileList.label")}
            values={["flat", "tree"] as const}
            value={options.fileList}
            text={(value) =>
              t(`workspace:reviews.diffOptions2.fileList.${value}`)
            }
            onChange={(fileList) => onChange({ fileList })}
          />
          <SegmentedOptions
            title={t("workspace:reviews.diffOptions2.grouping.label")}
            values={["none", "type"] as const}
            value={options.group}
            text={(value) =>
              t(`workspace:reviews.diffOptions2.grouping.${value}`)
            }
            onChange={(group) => onChange({ group })}
          />
          <SegmentedOptions
            title={t("workspace:reviews.diffOptions2.ordering.label")}
            values={["path", "changes"] as const}
            value={options.order}
            text={(value) =>
              t(`workspace:reviews.diffOptions2.ordering.${value}`)
            }
            onChange={(order) => onChange({ order })}
            lead={
              <Button
                size="icon-xs"
                variant="outline"
                aria-label={t(
                  `workspace:reviews.diffOptions2.ordering.${options.desc ? "desc" : "asc"}`,
                )}
                onClick={() => onChange({ desc: !options.desc })}
              >
                <ArrowDownUp />
              </Button>
            }
          />
          {toggles.slice(3).map(toggle)}
        </div>
      </PopoverContent>
    </Popover>
  );
}
