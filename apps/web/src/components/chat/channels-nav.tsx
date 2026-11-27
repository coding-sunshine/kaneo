import { Link } from "@tanstack/react-router";
import { ChevronRight, Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChannelNavItem } from "@/components/chat/channel-nav-item";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useChannels } from "@/hooks/queries/chat/use-channels";
import { useUserPreferencesStore } from "@/store/user-preferences";

/** Sidebar section: the channels you joined that are not archived. */
export function ChannelsNav({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: channels = [] } = useChannels(workspaceId);
  const collapsedNavIds = useUserPreferencesStore((s) => s.collapsedNavIds);
  const setNavOpen = useUserPreferencesStore((s) => s.setNavOpen);
  const joined = channels.filter(
    (channel) => channel.isMember && !channel.archivedAt,
  );

  return (
    <Collapsible
      open={!collapsedNavIds.includes("channels")}
      onOpenChange={(open) => setNavOpen("channels", open)}
      className="group/collapsible"
    >
      <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-2 text-xs text-sidebar-foreground" />
          }
        >
          <span>{t("navigation:chat.channels")}</span>
          <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsiblePanel className="-m-1 p-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {joined.map((channel) => (
                <ChannelNavItem
                  key={channel.id}
                  workspaceId={workspaceId}
                  channel={channel}
                />
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    <Link
                      to="/dashboard/workspace/$workspaceId/channels"
                      params={{ workspaceId }}
                    />
                  }
                >
                  <Compass />
                  <span>{t("navigation:chat.browse")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </SidebarGroup>
    </Collapsible>
  );
}
