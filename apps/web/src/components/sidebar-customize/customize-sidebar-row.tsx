import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DragHandle } from "@/components/project/sortable/drag-handle";
import { useSortableRow } from "@/components/project/sortable/use-sortable-row";
import {
  type SidebarVisibility,
  VISIBILITY_LABELS,
  visibilityOf,
  visibilityOptions,
} from "@/components/sidebar-customize/sidebar-items";
import type { SidebarNavItem } from "@/components/sidebar-customize/use-sidebar-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuRadioGroup,
  MenuRadioItem,
} from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function CustomizeSidebarRow({ item }: { item: SidebarNavItem }) {
  const { t } = useTranslation();
  const visibility = useUserPreferencesStore((state) =>
    visibilityOf(item.id, state.sidebar.visibility),
  );
  const setVisibility = useUserPreferencesStore(
    (state) => state.setSidebarVisibility,
  );
  const { rowRef, rowStyle, isDragging, handleProps } = useSortableRow(
    item.id,
    false,
  );
  const hidden = visibility === "never";

  return (
    <div
      ref={rowRef}
      style={rowStyle}
      className={cn(
        "group/row flex h-9 items-center gap-2 bg-card ps-3 pe-1.5 text-sm",
        isDragging && "relative z-10 rounded-md shadow-md",
      )}
    >
      <DragHandle
        label={t("navigation:customizeSidebar.reorder", { name: item.title })}
        handleProps={handleProps}
      />
      <item.icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          hidden ? "text-muted-foreground/70" : "text-muted-foreground",
        )}
      />
      <span
        className={cn("flex-1 truncate", hidden && "text-muted-foreground")}
      >
        {item.title}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="font-normal" />}
        >
          {t(VISIBILITY_LABELS[visibility])}
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <MenuRadioGroup
            value={visibility}
            onValueChange={(next) =>
              setVisibility(item.id, next as SidebarVisibility)
            }
          >
            {visibilityOptions(item.id).map((option) => (
              <MenuRadioItem key={option} value={option}>
                {t(VISIBILITY_LABELS[option])}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
