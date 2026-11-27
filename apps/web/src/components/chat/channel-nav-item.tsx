import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChannelIcon } from "@/components/chat/channel-icon";
import type { ChatChannel } from "@/components/chat/types";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";

/**
 * A joined channel or direct message in the sidebar: bold with a count while
 * it has news. A direct message passes the names of its people as `title`.
 */
export function ChannelNavItem({
  workspaceId,
  channel,
  title = channel.name,
}: {
  workspaceId: string;
  channel: ChatChannel;
  title?: string;
}) {
  const { t } = useTranslation();
  const unread = channel.unreadCount > 0;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            to="/dashboard/workspace/$workspaceId/channels/$channelId"
            params={{ workspaceId, channelId: channel.id }}
          />
        }
      >
        <ChannelIcon
          isPrivate={channel.isPrivate}
          isDirect={channel.isDirect}
        />
        <span
          className={cn(
            "min-w-0 truncate",
            unread && "font-semibold text-sidebar-foreground",
          )}
        >
          {title}
        </span>
      </SidebarMenuButton>
      {unread && (
        <SidebarMenuBadge
          aria-label={t("navigation:chat.unread", {
            count: channel.unreadCount,
          })}
        >
          {channel.unreadCount}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}
