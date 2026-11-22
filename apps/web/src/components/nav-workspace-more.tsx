import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, SquareUser, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

// Linear tucks Members and Teams behind a "More" row under Workspace.
export function NavWorkspaceMore({ homeUrl }: { homeUrl: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuButton />}>
          <MoreHorizontal aria-hidden="true" />
          <span>{t("navigation:sidebar.more")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44" side="bottom" align="start">
          <DropdownMenuItem
            onClick={() => navigate({ to: `${homeUrl}/members` })}
          >
            <Users aria-hidden="true" />
            {t("navigation:sidebar.members")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate({ to: "/dashboard/settings/projects" })}
          >
            <SquareUser aria-hidden="true" />
            {t("navigation:sidebar.teams")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
