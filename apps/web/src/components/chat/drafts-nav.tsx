import { Link } from "@tanstack/react-router";
import { PencilLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useChannels } from "@/hooks/queries/chat/use-channels";
import { useDirectMessages } from "@/hooks/queries/chat/use-direct-messages";
import { useDrafts } from "@/hooks/queries/chat/use-drafts";
import { useDirectMessageTitle } from "@/hooks/use-direct-message-title";

/** Sidebar section: the channels holding your unsent text. Hidden when none. */
export function DraftsNav({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: drafts = [] } = useDrafts(workspaceId);
  const { data: channels = [] } = useChannels(workspaceId);
  const { data: directMessages = [] } = useDirectMessages(workspaceId);
  const titleOf = useDirectMessageTitle(workspaceId);

  const titles = new Map<string, string>([
    ...channels.map((channel) => [channel.id, channel.name] as const),
    ...directMessages.map(
      (direct) => [direct.id, titleOf(direct.memberIds)] as const,
    ),
  ]);
  const listed = drafts.filter((draft) => titles.has(draft.channelId));
  if (!listed.length) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
      <SidebarGroupLabel className="h-7 px-2 text-xs text-sidebar-foreground">
        {t("navigation:chat.drafts")}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">
          {listed.map((draft) => (
            <SidebarMenuItem key={draft.channelId}>
              <SidebarMenuButton
                title={draft.body}
                render={
                  <Link
                    to="/dashboard/workspace/$workspaceId/channels/$channelId"
                    params={{ workspaceId, channelId: draft.channelId }}
                  />
                }
              >
                <PencilLine />
                <span className="min-w-0 truncate">
                  {titles.get(draft.channelId)}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
