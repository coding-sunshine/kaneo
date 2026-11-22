import { useNavigate } from "@tanstack/react-router";
import { BadgeInfo, Eye, Link, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BADGE_LABELS,
  BADGEABLE,
  badgeOf,
  type ItemBadge,
  VISIBILITY_LABELS,
  visibilityOf,
  visibilityOptions,
} from "@/components/sidebar-customize/sidebar-items";
import { BadgeSample } from "@/components/sidebar-customize/badge-sample";
import { MarkAllReadItem } from "@/components/sidebar-customize/mark-all-read-item";
import type { SidebarNavItem } from "@/components/sidebar-customize/use-sidebar-items";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";

type SidebarRowProps = {
  item: SidebarNavItem;
  isActive: boolean;
  workspaceId: string;
  onCustomize: () => void;
};

const BADGE_CHOICES: ItemBadge[] = ["count", "dot", "none"];

/** A customizable top-level sidebar row with Linear's right-click menu. */
export function SidebarRow({
  item,
  isActive,
  workspaceId,
  onCustomize,
}: SidebarRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sidebar = useUserPreferencesStore((state) => state.sidebar);
  const setVisibility = useUserPreferencesStore(
    (state) => state.setSidebarVisibility,
  );
  const setItemBadge = useUserPreferencesStore(
    (state) => state.setSidebarItemBadge,
  );
  const visibility = visibilityOf(item.id, sidebar.visibility);
  const badge = badgeOf(item.id, sidebar);
  const override = sidebar.itemBadges[item.id];
  const count = item.count ?? 0;

  const copyLink = async () => {
    const copied = await copyToClipboard(
      `${window.location.origin}${item.url}`,
    );
    if (copied) toast.success(t("navigation:customizeSidebar.linkCopied"));
    else toast.error(t("navigation:customizeSidebar.copyFailed"));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<SidebarMenuItem />}>
        <SidebarMenuButton
          tooltip={item.title}
          isActive={isActive}
          onClick={() => navigate({ to: item.url })}
        >
          <item.icon aria-hidden="true" />
          <span>{item.title}</span>
          {count > 0 && badge === "count" ? (
            <span className="ml-auto font-normal text-muted-foreground text-xs tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
          {count > 0 && badge === "dot" ? (
            <span
              aria-hidden="true"
              className="mr-1 ml-auto size-2 rounded-full bg-muted-foreground"
            />
          ) : null}
        </SidebarMenuButton>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {item.id === "inbox" ? (
          <>
            <MarkAllReadItem workspaceId={workspaceId} />
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Eye aria-hidden="true" />
            {t("navigation:customizeSidebar.visibility")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {visibilityOptions(item.id).map((option) => (
              <ContextMenuCheckboxItem
                key={option}
                checked={visibility === option}
                onCheckedChange={() => setVisibility(item.id, option)}
                closeOnClick
              >
                {t(VISIBILITY_LABELS[option])}
              </ContextMenuCheckboxItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {BADGEABLE.has(item.id) ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <BadgeInfo aria-hidden="true" />
              {t("navigation:customizeSidebar.badge")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuCheckboxItem
                checked={!override}
                onCheckedChange={() => setItemBadge(item.id, null)}
                closeOnClick
              >
                {t("navigation:customizeSidebar.badgeDefault", {
                  style: t(BADGE_LABELS[sidebar.badgeStyle]),
                })}
              </ContextMenuCheckboxItem>
              {BADGE_CHOICES.map((choice) => (
                <ContextMenuCheckboxItem
                  key={choice}
                  checked={override === choice}
                  onCheckedChange={() => setItemBadge(item.id, choice)}
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
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        <ContextMenuItem onClick={onCustomize}>
          <SquarePen aria-hidden="true" />
          {t("navigation:customizeSidebar.open")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void copyLink()}>
          <Link aria-hidden="true" />
          {t("navigation:customizeSidebar.copyLink")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
