import { useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  House,
  LogOut,
  Settings,
  SquarePen,
  UserPlus,
  Users,
} from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import Search from "@/components/search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import InviteTeamMemberModal from "@/components/team/invite-team-member-modal";
import { VersionDisplay } from "@/components/version-display";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import useSignOut from "@/hooks/mutations/use-sign-out";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import { useCreateIssueStore } from "@/store/create-issue";
import useProjectStore from "@/store/project";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { Kbd } from "@/components/ui/kbd";
import { getModifierKeyText } from "@/lib/shortcuts/platform";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { authClient } from "@/lib/auth-client";
import { hasInstanceAdminRole } from "@/lib/instance-admin";
import type { Workspace } from "@/types/workspace";
import CreateWorkspaceModal from "./shared/modals/create-workspace-modal";

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();

  const { data: workspaces } = useGetWorkspaces();
  const { data: session } = authClient.useSession();
  const { data: config } = useGetConfig();
  const isAdmin = hasInstanceAdminRole(session?.user?.role);
  const canCreateWorkspace =
    isAdmin || (config !== undefined && !config.disableWorkspaceCreation);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canInviteUsers } = useWorkspacePermission();
  const setCreateIssueOpen = useCreateIssueStore((state) => state.setOpen);
  const { setProject } = useProjectStore();
  const { mutateAsync: signOut, isPending: isSigningOut } = useSignOut(
    config?.customOAuthLogoutUrl,
  );
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    React.useState(false);
  const [isSwitching, setIsSwitching] = React.useState(false);

  const handleWorkspaceChange = React.useCallback(
    async (selectedWorkspace: Workspace) => {
      if (isSwitching) return;

      setIsSwitching(true);
      try {
        await authClient.organization.setActive({
          organizationId: selectedWorkspace.id,
        });

        setTimeout(() => {
          navigate({
            to: "/dashboard/workspace/$workspaceId",
            params: { workspaceId: selectedWorkspace.id },
          });
        }, 50);
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      } finally {
        setTimeout(() => setIsSwitching(false), 100);
      }
    },
    [navigate, isSwitching],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!workspaces || workspaces.length === 0) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key >= "1" &&
        event.key <= "9"
      ) {
        event.preventDefault();
        const index = Number.parseInt(event.key, 10) - 1;
        if (index < workspaces.length) {
          handleWorkspaceChange(workspaces[index]);
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, workspaces, handleWorkspaceChange]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setProject(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("navigation:userMenu.signOutFailed"),
      );
    }
  };

  useShortcut("switchWorkspace", () => setIsOpen(true));
  useShortcut("logOut", () => void handleSignOut(), { enabled: Boolean(user) });

  if (!workspace) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between w-full gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className="group w-auto max-w-full gap-1.5 rounded-[10px] pr-2 pl-1.5 text-sidebar-foreground"
                    size="default"
                  />
                }
              >
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-primary font-semibold text-[10px] text-primary-foreground"
                >
                  {getInitials(workspace.name, "WS")}
                </span>
                <span
                  className={`truncate font-semibold text-foreground ${isSwitching ? "opacity-50" : ""}`}
                >
                  {workspace.name}
                </span>
                {isSwitching ? (
                  <Spinner className="size-3 text-foreground/70" />
                ) : (
                  <ChevronDown className="size-3 shrink-0 text-foreground/60" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-60 text-sidebar-foreground"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuItem
                  className="h-7 text-sm"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/workspace/$workspaceId",
                      params: { workspaceId: workspace.id },
                    })
                  }
                >
                  <House />
                  {t("navigation:sidebar.home")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-7 text-sm"
                  onClick={() =>
                    navigate({
                      to: "/dashboard/workspace/$workspaceId/members",
                      params: { workspaceId: workspace.id },
                    })
                  }
                >
                  <Users />
                  {t("navigation:sidebar.members")}
                </DropdownMenuItem>
                {canInviteUsers() && (
                  <DropdownMenuItem
                    className="h-7 text-sm"
                    onClick={() => setIsInviteOpen(true)}
                  >
                    <UserPlus />
                    {t("navigation:sidebar.invitePeople")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="h-7 text-sm"
                  onClick={() =>
                    navigate({ to: "/dashboard/settings/account/information" })
                  }
                >
                  <Settings />
                  {t("navigation:userMenu.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {t("navigation:workspaceSwitcher.workspaces")}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                {workspaces?.map((ws: Workspace, index: number) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => {
                      if (!isSwitching && ws.id !== workspace.id) {
                        handleWorkspaceChange(ws);
                        setIsOpen(false);
                      }
                    }}
                    disabled={isSwitching || ws.id === workspace.id}
                    className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                  >
                    <span className="flex-1 text-left">
                      {isSwitching && ws.id === workspace?.id
                        ? t("navigation:workspaceSwitcher.switching")
                        : ws.name}
                    </span>
                    <DropdownMenuShortcut className="gap-0.5">
                      <Kbd tone="muted">{getModifierKeyText()}</Kbd>
                      <Kbd tone="muted">{index > 8 ? "0" : index + 1}</Kbd>
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}

                {canCreateWorkspace && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setIsCreateWorkspaceModalOpen(true);
                        setIsOpen(false);
                      }}
                      className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                    >
                      <span>
                        {t("navigation:workspaceSwitcher.addWorkspace")}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="h-7 text-sm"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  <LogOut />
                  {isSigningOut
                    ? t("navigation:userMenu.signingOut")
                    : t("navigation:userMenu.logOut")}
                </DropdownMenuItem>
                <VersionDisplay />
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-0.5">
          <Search />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-full border border-border/70 text-muted-foreground hover:bg-sidebar-accent/70"
            onClick={() => setCreateIssueOpen(true)}
          >
            <SquarePen aria-hidden="true" className="size-4" />
            <span className="sr-only">{t("navigation:sidebar.newIssue")}</span>
          </Button>
        </div>
      </div>

      <InviteTeamMemberModal
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
      />
    </>
  );
}
