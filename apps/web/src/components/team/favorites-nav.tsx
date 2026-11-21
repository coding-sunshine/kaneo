import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers2 } from "lucide-react";
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
import icons from "@/constants/project-icons";
import { useFavorites } from "@/hooks/queries/favorite/use-favorites";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useViews } from "@/hooks/queries/view/use-views";
import { teamColor } from "@/lib/team-color";
import { useUserPreferencesStore } from "@/store/user-preferences";

/** Linear's Favorites section: starred teams and views, above the team list. */
export function FavoritesNav({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: favorites = [] } = useFavorites(workspaceId);
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const { data: views = [] } = useViews(workspaceId);
  const collapsedNavIds = useUserPreferencesStore((s) => s.collapsedNavIds);
  const setNavOpen = useUserPreferencesStore((s) => s.setNavOpen);

  const rows = favorites.flatMap((favorite) => {
    if (favorite.type === "project") {
      const project = projects.find((item) => item.id === favorite.targetId);
      if (!project) return [];
      const Icon = icons[project.icon as keyof typeof icons] || icons.Layout;
      return [
        {
          key: favorite.id,
          name: project.name,
          icon: <Icon style={{ color: teamColor(project.id) }} />,
          link: (
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/board"
              params={{ workspaceId, projectId: project.id }}
            />
          ),
        },
      ];
    }
    const view = views.find((item) => item.id === favorite.targetId);
    if (!view) return [];
    return [
      {
        key: favorite.id,
        name: view.name,
        icon: <Layers2 />,
        link: (
          <Link
            to="/dashboard/workspace/$workspaceId/views/$viewId"
            params={{ workspaceId, viewId: view.id }}
          />
        ),
      },
    ];
  });

  if (rows.length === 0) return null;

  return (
    <Collapsible
      open={!collapsedNavIds.includes("favorites")}
      onOpenChange={(open) => setNavOpen("favorites", open)}
      className="group/collapsible"
    >
      <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-2 text-xs text-sidebar-foreground" />
          }
        >
          <span>{t("navigation:sidebar.favorites")}</span>
          <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsiblePanel className="-m-1 p-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {rows.map((row) => (
                <SidebarMenuItem key={row.key}>
                  <SidebarMenuButton render={row.link}>
                    {row.icon}
                    <span className="min-w-0 truncate">{row.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </SidebarGroup>
    </Collapsible>
  );
}
