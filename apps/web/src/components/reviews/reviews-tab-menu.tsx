import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyText } from "@/lib/copy-text";

/** Linear's tab menu: copy the tab's link, then move it one step in the only direction left. */
export function ReviewsTabMenu({
  tab,
  first,
  onMove,
  children,
}: {
  tab: string;
  first: boolean;
  onMove: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const link = () => {
    const url = new URL(window.location.href);
    url.search = `?tab=${tab}`;
    return copyText(
      url.toString(),
      t("workspace:reviews.tabMenu.linkCopied"),
      t("workspace:reviews.detail.menu.copyFailed"),
    );
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<span className="inline-flex" />}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={link}>
          {t("workspace:reviews.tabMenu.copyLink")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onMove}>
          {first
            ? t("workspace:reviews.tabMenu.moveRight")
            : t("workspace:reviews.tabMenu.moveLeft")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
