import { LayoutList, SlidersHorizontal, SquareKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import type { MyTasksTab } from "@/fetchers/task/get-assigned-tasks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type MyTasksGroupBy = "status" | "dueDate" | "project";
export type MyTasksLayout = "list" | "board";

type MyTasksGroupByProps = {
  value: MyTasksGroupBy;
  onChange: (value: MyTasksGroupBy) => void;
  layout: MyTasksLayout;
  onLayoutChange: (value: MyTasksLayout) => void;
};

export function MyTasksGroupByToggle({
  value,
  onChange,
  layout,
  onLayoutChange,
}: MyTasksGroupByProps) {
  const { t } = useTranslation();
  const options: Array<{ value: MyTasksGroupBy; label: string }> = [
    { value: "status", label: t("workspace:myTasks.groupBy.status") },
    { value: "dueDate", label: t("workspace:myTasks.groupBy.dueDate") },
    { value: "project", label: t("workspace:myTasks.groupBy.project") },
  ];
  const current = options.find((option) => option.value === value);

  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" size="icon-xs" />}
        title={t("workspace:myTasks.display", "Display options")}
      >
        <SlidersHorizontal />
        <span className="sr-only">
          {t("workspace:myTasks.display", "Display options")}
        </span>
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-56">
        <div className="grid grid-cols-2 gap-1.5 p-1">
          {(
            [
              ["list", "List", LayoutList],
              ["board", "Board", SquareKanban],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={layout === id}
              onClick={() => onLayoutChange(id)}
              className={cn(
                "flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-[13px] outline-none",
                layout === id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <MenuSub>
          <MenuSubTrigger>
            {t("workspace:myTasks.groupBy.label")}
            <span className="ms-auto text-muted-foreground text-xs">
              {current?.label}
            </span>
          </MenuSubTrigger>
          <MenuSubPopup>
            <MenuRadioGroup
              value={value}
              onValueChange={(next) => onChange(next as MyTasksGroupBy)}
            >
              {options.map((option) => (
                <MenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuSubPopup>
        </MenuSub>
      </MenuPopup>
    </Menu>
  );
}

export function MyTasksTabs({
  value,
  onChange,
}: {
  value: MyTasksTab;
  onChange: (value: MyTasksTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="tablist" className="inline-flex items-center gap-1.5">
      {(["assigned", "created", "subscribed", "activity"] as const).map(
        (tab) => (
          <Button
            key={tab}
            role="tab"
            aria-selected={value === tab}
            variant="outline"
            size="xs"
            onClick={() => onChange(tab)}
            className={cn(
              "rounded-full",
              value === tab
                ? "bg-accent text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t(
              `workspace:myTasks.tabs.${tab}`,
              tab[0].toUpperCase() + tab.slice(1),
            )}
          </Button>
        ),
      )}
    </div>
  );
}
