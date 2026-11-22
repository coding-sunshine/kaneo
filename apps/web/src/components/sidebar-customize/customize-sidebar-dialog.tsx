import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BadgeSample } from "@/components/sidebar-customize/badge-sample";
import { CustomizeSidebarSection } from "@/components/sidebar-customize/customize-sidebar-section";
import {
  BADGE_LABELS,
  type BadgeStyle,
} from "@/components/sidebar-customize/sidebar-items";
import type { SidebarNavItem } from "@/components/sidebar-customize/use-sidebar-items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  MenuRadioGroup,
  MenuRadioItem,
} from "@/components/ui/menu";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CustomizeSidebarDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personal: SidebarNavItem[];
  workspace: SidebarNavItem[];
};

const BADGE_STYLES: BadgeStyle[] = ["count", "dot"];

export function CustomizeSidebarDialog({
  open,
  onOpenChange,
  personal,
  workspace,
}: CustomizeSidebarDialogProps) {
  const { t } = useTranslation();
  const badgeStyle = useUserPreferencesStore(
    (state) => state.sidebar.badgeStyle,
  );
  const setBadgeStyle = useUserPreferencesStore(
    (state) => state.setSidebarBadgeStyle,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-medium text-base">
            {t("navigation:customizeSidebar.title")}
          </DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-6">
          <div className="flex h-12 items-center justify-between rounded-lg border bg-card ps-4 pe-1.5 text-sm">
            <span className="font-medium">
              {t("navigation:customizeSidebar.defaultBadgeStyle")}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" className="font-normal" />
                }
              >
                <BadgeSample style={badgeStyle} />
                <span className="ms-1.5">{t(BADGE_LABELS[badgeStyle])}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <MenuRadioGroup
                  value={badgeStyle}
                  onValueChange={(next) => setBadgeStyle(next as BadgeStyle)}
                >
                  {BADGE_STYLES.map((style) => (
                    <MenuRadioItem key={style} value={style}>
                      {t(BADGE_LABELS[style])}
                      <span className="ms-auto flex items-center">
                        <BadgeSample style={style} />
                      </span>
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <CustomizeSidebarSection section="personal" items={personal} />
          <CustomizeSidebarSection section="workspace" items={workspace} />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
