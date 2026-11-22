import { EllipsisIcon, Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

type TeamRowMenuProps = {
  joined: boolean;
  canDelete: boolean;
  onSettings: () => void;
  onLeave: () => void;
  onJoin: () => void;
  onDelete: () => void;
};

/** Linear's row menu: Settings | Leave team or Join team | Delete. */
export function TeamRowMenu({
  joined,
  canDelete,
  onSettings,
  onLeave,
  onJoin,
  onDelete,
}: TeamRowMenuProps) {
  const { t } = useTranslation();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("settings:teams.openMenu")}
            className="text-muted-foreground"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuItem closeOnClick onClick={onSettings}>
          <Settings aria-hidden="true" />
          {t("settings:teams.menuSettings")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem closeOnClick onClick={joined ? onLeave : onJoin}>
          {joined
            ? t("navigation:projectList.leaveTeam")
            : t("navigation:projectList.joinTeam")}
        </MenuItem>
        {canDelete ? (
          <>
            <MenuSeparator />
            <MenuItem closeOnClick onClick={onDelete}>
              <Trash2 aria-hidden="true" />
              {t("settings:teams.menuDelete")}
            </MenuItem>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
}
