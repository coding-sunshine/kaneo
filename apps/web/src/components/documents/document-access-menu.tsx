import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type { DocumentAccess } from "@/fetchers/document/documents";

const ACCESS: DocumentAccess[] = ["edit", "comment", "view"];

type DocumentAccessMenuProps = {
  value: DocumentAccess;
  onChange: (access: DocumentAccess) => void;
  onRemove?: () => void;
  /** Without rights to change it, the level is shown as plain text. */
  readOnly?: boolean;
};

/** The "Can edit ▾" picker in Linear's share popover. */
export function DocumentAccessMenu({
  value,
  onChange,
  onRemove,
  readOnly,
}: DocumentAccessMenuProps) {
  const { t } = useTranslation();
  const label = t(`navigation:documents.share.access.${value}`);
  if (readOnly) {
    return <span className="text-muted-foreground text-xs">{label}</span>;
  }
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-muted-foreground"
          />
        }
      >
        {label}
        <ChevronDown aria-hidden className="size-3" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-36">
        <MenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as DocumentAccess)}
        >
          {ACCESS.map((access) => (
            <MenuRadioItem key={access} value={access}>
              {t(`navigation:documents.share.access.${access}`)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        {onRemove && (
          <>
            <MenuSeparator />
            <MenuItem variant="destructive" onClick={onRemove}>
              {t("navigation:documents.share.remove")}
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}
