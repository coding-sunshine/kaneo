import { Ellipsis, Link2, Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

/** The ··· next to the Documents title. */
export function DocumentsPageMenu({
  onChoosePins,
}: {
  onChoosePins: () => void;
}) {
  const { t } = useTranslation();
  const copyLink = async () => {
    if (await copyToClipboard(window.location.href)) {
      toast.success(t("navigation:documents.linkCopied"));
    }
  };
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("navigation:documents.pageOptions")}
          />
        }
      >
        <Ellipsis aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-52">
        <MenuItem onClick={onChoosePins}>
          <Pin aria-hidden />
          {t("navigation:documents.pins.choose")}
        </MenuItem>
        <MenuItem onClick={copyLink}>
          <Link2 aria-hidden />
          {t("navigation:documents.copyLink")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
