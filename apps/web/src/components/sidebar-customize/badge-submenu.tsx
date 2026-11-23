import { BadgeInfo } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeSample } from "@/components/sidebar-customize/badge-sample";
import {
  BADGE_LABELS,
  type InboxCountMode,
  type ItemBadge,
  type SidebarItemId,
} from "@/components/sidebar-customize/sidebar-items";
import {
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useUserPreferencesStore } from "@/store/user-preferences";

const BADGE_CHOICES: ItemBadge[] = ["count", "dot", "none"];
const COUNT_MODES = [
  ["all", "navigation:customizeSidebar.countAll"],
  ["priority", "navigation:customizeSidebar.countPriority"],
  ["none", "navigation:customizeSidebar.none"],
] as const satisfies readonly (readonly [InboxCountMode, string])[];

// Keys that edit text must not reach the menu's typeahead and arrow handling.
const TEXT_KEYS = new Set(["Backspace", "Delete", "ArrowLeft", "ArrowRight"]);

/** Linear's Badge submenu: a filter box over the badge styles and, for Inbox, what it counts. */
export function BadgeSubmenu({ id }: { id: SidebarItemId }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const sidebar = useUserPreferencesStore((state) => state.sidebar);
  const setItemBadge = useUserPreferencesStore(
    (state) => state.setSidebarItemBadge,
  );
  const setInboxCount = useUserPreferencesStore(
    (state) => state.setSidebarInboxCount,
  );
  const override = sidebar.itemBadges[id];
  const query = filter.trim().toLowerCase();
  const matches = (label: string) => label.toLowerCase().includes(query);

  const defaultLabel = t("navigation:customizeSidebar.badgeDefault", {
    style: t(BADGE_LABELS[sidebar.badgeStyle]),
  });
  const choices = BADGE_CHOICES.filter((choice) =>
    matches(t(BADGE_LABELS[choice])),
  );
  const showDefault = matches(defaultLabel);
  const includeLabel = t("navigation:customizeSidebar.includeInCount");
  const showInclude = id === "inbox" && matches(includeLabel);

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <BadgeInfo aria-hidden="true" />
        {t("navigation:customizeSidebar.badge")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-56">
        <div className="px-2 py-1">
          <input
            // biome-ignore lint/a11y/noAutofocus: Linear focuses the filter as the submenu opens.
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key.length === 1 || TEXT_KEYS.has(event.key)) {
                event.stopPropagation();
              }
            }}
            placeholder={t("navigation:customizeSidebar.badgeFilter")}
            aria-label={t("navigation:customizeSidebar.badgeFilter")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ContextMenuSeparator />
        {showDefault ? (
          <ContextMenuCheckboxItem
            checked={!override}
            onCheckedChange={() => setItemBadge(id, null)}
            closeOnClick
          >
            {defaultLabel}
          </ContextMenuCheckboxItem>
        ) : null}
        {choices.map((choice) => (
          <ContextMenuCheckboxItem
            key={choice}
            checked={override === choice}
            onCheckedChange={() => setItemBadge(id, choice)}
            closeOnClick
          >
            {t(BADGE_LABELS[choice])}
            {choice === "none" ? null : (
              <span className="ms-auto flex items-center">
                <BadgeSample style={choice} />
              </span>
            )}
          </ContextMenuCheckboxItem>
        ))}
        {showInclude ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>{includeLabel}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {COUNT_MODES.map(([mode, label]) => (
                  <ContextMenuCheckboxItem
                    key={mode}
                    checked={sidebar.inboxCount === mode}
                    onCheckedChange={() => setInboxCount(mode)}
                    closeOnClick
                  >
                    {t(label)}
                  </ContextMenuCheckboxItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        ) : null}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
