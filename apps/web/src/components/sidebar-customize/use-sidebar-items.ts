import {
  Activity,
  Box,
  CircleUserRound,
  FilePen,
  FileText,
  GitPullRequest,
  Inbox,
  Layers2,
  type LucideIcon,
  Mail,
  MousePointer2,
  SquareUser,
  Users,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { inboxCount } from "@/components/sidebar-customize/inbox-count";
import type { SidebarItemId } from "@/components/sidebar-customize/sidebar-items";
import { useTaskDrafts } from "@/hooks/queries/task-draft/use-task-drafts";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import {
  useReviewsList,
  useReviewsStatus,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useUserPreferencesStore } from "@/store/user-preferences";

export type NavItem = {
  title: string;
  icon: LucideIcon;
  url: string;
  count?: number;
};
export type SidebarNavItem = NavItem & { id: SidebarItemId };

/** Every top-level sidebar row this person can see, before their customizations. */
export function useSidebarItems() {
  const { t } = useTranslation();
  const codeReviewsEnabled = useUserPreferencesStore(
    (state) => state.codeReviewsEnabled,
  );
  const { data: workspace } = useActiveWorkspace();
  const { data: invitations = [] } = usePendingInvitations();
  const { data: notifications = [] } = useGetNotifications(workspace?.id);
  const hasAgent = useHasAgent();
  const inboxCountMode = useUserPreferencesStore(
    (state) => state.sidebar.inboxCount,
  );
  // Same query keys as the Reviews page, so the badge shares its cache and polling.
  const reviewsStatus = useReviewsStatus(codeReviewsEnabled);
  const reviewsList = useReviewsList(
    { includeDrafts: false, includeClosed: false },
    codeReviewsEnabled && reviewsStatus.data?.state === "connected",
  );
  const { data: drafts = [] } = useTaskDrafts(workspace?.id);

  if (!workspace) return null;

  const homeUrl = `/dashboard/workspace/${workspace.id}`;
  const item = (
    id: SidebarItemId,
    title: string,
    icon: LucideIcon,
    url: string,
    count?: number,
  ): SidebarNavItem => ({ id, title, icon, url, count });

  const personal = [
    item(
      "inbox",
      t("navigation:sidebar.inbox"),
      Inbox,
      `${homeUrl}/inbox`,
      inboxCount(notifications, inboxCountMode),
    ),
    item(
      "myTasks",
      t("navigation:sidebar.myTasks"),
      CircleUserRound,
      `${homeUrl}/my-tasks`,
    ),
    ...(codeReviewsEnabled
      ? [
          item(
            "reviews",
            t("navigation:sidebar.reviews"),
            GitPullRequest,
            `${homeUrl}/reviews`,
            reviewsList.data?.toReview.length,
          ),
        ]
      : []),
    item("pulse", t("navigation:sidebar.pulse"), Activity, `${homeUrl}/pulse`),
    item(
      "documents",
      t("navigation:sidebar.documents"),
      FileText,
      `${homeUrl}/documents`,
    ),
    ...(hasAgent
      ? [
          item(
            "agent",
            t("navigation:sidebar.agent"),
            MousePointer2,
            `${homeUrl}/agent`,
          ),
        ]
      : []),
    item(
      "drafts",
      t("navigation:sidebar.drafts"),
      FilePen,
      `${homeUrl}/drafts`,
      drafts.length,
    ),
  ];

  const workspaceItems = [
    item(
      "projects",
      t("navigation:sidebar.projects"),
      Box,
      `${homeUrl}/work-projects`,
    ),
    item("views", t("navigation:sidebar.views"), Layers2, `${homeUrl}/views`),
    item(
      "members",
      t("navigation:sidebar.members"),
      Users,
      `${homeUrl}/members`,
    ),
    ...(hasAgent
      ? [
          item(
            "loops",
            t("navigation:sidebar.loops"),
            Workflow,
            `${homeUrl}/loops`,
          ),
        ]
      : []),
    item(
      "teams",
      t("navigation:sidebar.teams"),
      SquareUser,
      "/dashboard/settings/projects",
    ),
  ];

  // Invitations to other workspaces only matter while one is waiting, so
  // the row is not customizable.
  const invitationsItem: NavItem | null =
    invitations.length > 0
      ? {
          title: t("navigation:sidebar.invitations"),
          icon: Mail,
          url: "/dashboard/invitations",
          count: invitations.length,
        }
      : null;

  return {
    workspaceId: workspace.id,
    personal,
    workspace: workspaceItems,
    invitations: invitationsItem,
  };
}
