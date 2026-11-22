import { useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
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
import { CustomizeSidebarDialog } from "@/components/sidebar-customize/customize-sidebar-dialog";
import { arrangeSection } from "@/components/sidebar-customize/sidebar-items";
import { SidebarRow } from "@/components/sidebar-customize/sidebar-row";
import { useSidebarItems } from "@/components/sidebar-customize/use-sidebar-items";
import { useUserPreferencesStore } from "@/store/user-preferences";

const isActive = (pathname: string, url: string) =>
  pathname === url || pathname.startsWith(`${url}/`);

export function NavMain() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const sidebar = useUserPreferencesStore((state) => state.sidebar);
  const [customizing, setCustomizing] = useState(false);
  const items = useSidebarItems();

  if (!items) return null;

  const personal = arrangeSection("personal", items.personal, sidebar);
  const workspace = arrangeSection("workspace", items.workspace, sidebar);
  const customize = () => setCustomizing(true);
  const rows = (shown: typeof personal.shown) =>
    shown.map((item) => (
      <SidebarRow
        key={item.id}
        item={item}
        isActive={isActive(pathname, item.url)}
        workspaceId={items.workspaceId}
        onCustomize={customize}
      />
    ));
  const invitations = items.invitations;

  return (
    <>
      <SidebarGroup className="p-2 pb-0">
        <SidebarGroupContent>
          <SidebarMenu className="gap-px">
            {rows(personal.shown)}
            {invitations ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={invitations.title}
                  isActive={isActive(pathname, invitations.url)}
                  onClick={() => navigate({ to: invitations.url })}
                >
                  <invitations.icon aria-hidden="true" />
                  <span>{invitations.title}</span>
                  <span className="ml-auto font-normal text-muted-foreground text-xs tabular-nums">
                    {invitations.count}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
          </SidebarMenu>
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
              <SidebarMenu className="gap-px">
                {rows(workspace.shown)}
                <NavWorkspaceMore
                  hidden={workspace.hidden}
                  onCustomize={customize}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>
      <CustomizeSidebarDialog
        open={customizing}
        onOpenChange={setCustomizing}
        personal={items.personal}
        workspace={items.workspace}
      />
    </>
  );
}
