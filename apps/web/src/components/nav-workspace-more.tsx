import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NavItem } from "@/components/sidebar-customize/use-sidebar-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

// Linear keeps the workspace rows set to "Don't show" behind a "More" row.
export function NavWorkspaceMore({
  hidden,
  onCustomize,
}: {
  hidden: NavItem[];
  onCustomize: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuButton />}>
          <MoreHorizontal aria-hidden="true" />
          <span>{t("navigation:sidebar.more")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" side="bottom" align="start">
          {hidden.map((item) => (
            <DropdownMenuItem
              key={item.url}
              onClick={() => navigate({ to: item.url })}
            >
              <item.icon aria-hidden="true" />
              {item.title}
            </DropdownMenuItem>
          ))}
          {hidden.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onClick={onCustomize}>
            <SquarePen aria-hidden="true" />
            {t("navigation:customizeSidebar.open")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
