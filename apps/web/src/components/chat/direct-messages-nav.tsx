import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChannelNavItem } from "@/components/chat/channel-nav-item";
import { StartDirectMessageDialog } from "@/components/chat/start-direct-message-dialog";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { useDirectMessages } from "@/hooks/queries/chat/use-direct-messages";
import { useDirectMessageTitle } from "@/hooks/use-direct-message-title";
import { useUserPreferencesStore } from "@/store/user-preferences";

/** Sidebar section: your direct messages and group direct messages. */
export function DirectMessagesNav({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: directMessages = [] } = useDirectMessages(workspaceId);
  const titleOf = useDirectMessageTitle(workspaceId);
  const collapsedNavIds = useUserPreferencesStore((s) => s.collapsedNavIds);
  const setNavOpen = useUserPreferencesStore((s) => s.setNavOpen);
  const [starting, setStarting] = useState(false);

  return (
    <Collapsible
      open={!collapsedNavIds.includes("direct-messages")}
      onOpenChange={(open) => setNavOpen("direct-messages", open)}
      className="group/collapsible"
    >
      <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-2 text-xs text-sidebar-foreground" />
          }
        >
          <span>{t("navigation:chat.directMessages")}</span>
          <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 transition-transform duration-200" />
        </CollapsibleTrigger>
        <SidebarGroupAction
          className="top-1.5 right-2 text-sidebar-foreground/70"
          title={t("navigation:chat.newDirectMessage")}
          onClick={() => setStarting(true)}
        >
          <Plus />
          <span className="sr-only">
            {t("navigation:chat.newDirectMessage")}
          </span>
        </SidebarGroupAction>
        <CollapsiblePanel className="-m-1 p-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {directMessages.map((directMessage) => (
                <ChannelNavItem
                  key={directMessage.id}
                  workspaceId={workspaceId}
                  channel={directMessage}
                  title={titleOf(directMessage.memberIds)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </SidebarGroup>
      <StartDirectMessageDialog
        open={starting}
        onOpenChange={setStarting}
        workspaceId={workspaceId}
      />
    </Collapsible>
  );
}
