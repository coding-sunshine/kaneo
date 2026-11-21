import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  CircleUserRound,
  Box,
  Inbox,
  type LucideIcon,
  Mail,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

type NavItem = {
  title: string;
  icon: LucideIcon;
  url: string;
  count?: number;
};

function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const navigate = useNavigate();
  return (
    <SidebarMenu className="gap-px">
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={pathname === item.url}
            onClick={() => navigate({ to: item.url })}
          >
            <item.icon aria-hidden="true" />
            <span>{item.title}</span>
            {item.count ? (
              <span className="ml-auto font-normal text-muted-foreground text-xs tabular-nums">
                {item.count > 99 ? "99+" : item.count}
              </span>
            ) : null}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const { data: invitations = [] } = usePendingInvitations();
  const { data: notifications = [] } = useGetNotifications(workspace?.id);
  const { data: assignedTasks } = useGetAssignedTasks(workspace?.id, true);

  if (!workspace) return null;

  const homeUrl = `/dashboard/workspace/${workspace.id}`;
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const personal: NavItem[] = [
    {
      title: t("navigation:sidebar.inbox"),
      icon: Inbox,
      url: `${homeUrl}/inbox`,
      count: unreadCount,
    },
    {
      title: t("navigation:sidebar.myTasks"),
      icon: CircleUserRound,
      url: `${homeUrl}/my-tasks`,
      count: assignedTasks?.total,
    },
  ];

  // Invitations to other workspaces only matter while one is waiting.
  if (invitations.length > 0) {
    personal.push({
      title: t("navigation:sidebar.invitations"),
      icon: Mail,
      url: "/dashboard/invitations",
      count: invitations.length,
    });
  }

  // Linear's Views and More have no Kaneo page yet (UX-47).
  const workspaceItems: NavItem[] = [
    {
      title: t("navigation:sidebar.projects"),
      icon: Box,
      url: `${homeUrl}/projects`,
    },
  ];

  return (
    <>
      <SidebarGroup className="p-2 pb-0">
        <SidebarGroupContent>
          <NavItems items={personal} pathname={pathname} />
        </SidebarGroupContent>
      </SidebarGroup>
      <Collapsible defaultOpen className="group/workspace">
        <SidebarGroup className="p-2 pt-3 pb-0">
          <CollapsibleTrigger
            className="data-panel-open:[&_svg]:rotate-90"
            render={
              <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-2 text-xs text-sidebar-foreground" />
            }
          >
            <span>{t("navigation:sidebar.workspace")}</span>
            <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <SidebarGroupContent>
              <NavItems items={workspaceItems} pathname={pathname} />
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>
    </>
  );
}
