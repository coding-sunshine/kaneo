import { Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { copyText } from "@/lib/copy-text";

/** The file header's ⋯ menu: copy the path, or read the file on GitHub. */
export function FileActionsMenu({
  filename,
  githubUrl,
}: {
  filename: string;
  /** Null for a removed file, which no longer exists at the head commit. */
  githubUrl: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0"
            aria-label={t("workspace:reviews.detail.fileActions")}
          />
        }
      >
        <MoreHorizontal />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem
          onClick={() =>
            copyText(
              filename,
              t("workspace:reviews.detail.pathCopied"),
              t("workspace:reviews.detail.menu.copyFailed"),
            )
          }
        >
          <Copy />
          {t("workspace:reviews.detail.copyPath")}
        </MenuItem>
        {githubUrl && (
          <MenuItem
            render={
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" />
            }
          >
            <ExternalLink />
            {t("workspace:reviews.detail.openOnGithub")}
          </MenuItem>
        )}
      </MenuPopup>
    </Menu>
  );
}
