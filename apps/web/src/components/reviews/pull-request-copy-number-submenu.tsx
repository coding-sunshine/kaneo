import { Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MenuItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";

/** "Copy pull request number..." with its two forms. */
export function PullRequestCopyNumberSubmenu({
  copy,
}: {
  copy: { numberOnly: () => void; numberWithRepo: () => void };
}) {
  const { t } = useTranslation();
  return (
    <MenuSub>
      <MenuSubTrigger>
        <Hash />
        {t("workspace:reviews.copyMenu.number")}
      </MenuSubTrigger>
      <MenuSubPopup>
        <MenuItem onClick={copy.numberOnly}>
          {t("workspace:reviews.copyMenu.numberOnly")}
        </MenuItem>
        <MenuItem onClick={copy.numberWithRepo}>
          {t("workspace:reviews.copyMenu.numberWithRepo")}
        </MenuItem>
      </MenuSubPopup>
    </MenuSub>
  );
}
