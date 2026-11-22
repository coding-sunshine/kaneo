import { isSnoozed } from "@/components/inbox/snooze";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ChevronRight,
  CircleUserRound,
  GitPullRequest,
  Box,
  FileText,
  Inbox,
  Layers2,
  type LucideIcon,
  Mail,
  MousePointer2,
  Workflow,
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
import { NavWorkspaceMore } from "@/components/nav-workspace-more";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useUserPreferencesStore } from "@/store/user-preferences";

type NavItem = {
  title: string;
  icon: LucideIcon;
  url: string;
  count?: number;
};

function NavItems({
  items,
  pathname,
  children,
}: {
  items: NavItem[];
  pathname: string;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <SidebarMenu className="gap-px">
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={
              pathname === item.url || pathname.startsWith(`${item.url}/`)
            }
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
      {children}
    </SidebarMenu>
  );
}

export function NavMain() {
  const { t } = useTranslation();
  const codeReviewsEnabled = useUserPreferencesStore(
    (state) => state.codeReviewsEnabled,
  );
  const { data: workspace } = useActiveWorkspace();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const { data: invitations = [] } = usePendingInvitations();
  const { data: notifications = [] } = useGetNotifications(workspace?.id);
  const { data: assignedTasks } = useGetAssignedTasks(workspace?.id, true);
  const hasAgent = useHasAgent();

  if (!workspace) return null;

  const homeUrl = `/dashboard/workspace/${workspace.id}`;
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead && !isSnoozed(notification),
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
    ...(codeReviewsEnabled
      ? [
          {
            title: t("navigation:sidebar.reviews"),
            icon: GitPullRequest,
            url: `${homeUrl}/reviews`,
          },
        ]
      : []),
    {
      title: t("navigation:sidebar.pulse"),
      icon: Activity,
      url: `${homeUrl}/pulse`,
    },
    {
      title: t("navigation:sidebar.documents"),
      icon: FileText,
      url: `${homeUrl}/documents`,
    },
  ];

  if (hasAgent) {
    personal.push({
      title: t("navigation:sidebar.agent"),
      icon: MousePointer2,
      url: `${homeUrl}/agent`,
    });
  }

  // Invitations to other workspaces only matter while one is waiting.
  if (invitations.length > 0) {
    personal.push({
      title: t("navigation:sidebar.invitations"),
      icon: Mail,
      url: "/dashboard/invitations",
      count: invitations.length,
    });
  }

  const workspaceItems: NavItem[] = [
    {
      title: t("navigation:sidebar.projects"),
      icon: Box,
      url: `${homeUrl}/work-projects`,
    },
    {
      title: t("navigation:sidebar.views"),
      icon: Layers2,
      url: `${homeUrl}/views`,
    },
  ];

  if (hasAgent) {
    workspaceItems.push({
      title: t("navigation:sidebar.loops"),
      icon: Workflow,
      url: `${homeUrl}/loops`,
    });
  }

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
              <NavItems items={workspaceItems} pathname={pathname}>
                <NavWorkspaceMore homeUrl={homeUrl} />
              </NavItems>
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>
    </>
  );
}
