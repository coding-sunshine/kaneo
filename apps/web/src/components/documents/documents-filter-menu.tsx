import { ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type { DocumentScope } from "@/fetchers/document/documents";
import { cn } from "@/lib/cn";

const SCOPES: DocumentScope[] = [
  "private",
  "workspace",
  "team",
  "project",
  "issue",
];

type DocumentsFilterMenuProps = {
  /** Scopes to show; empty shows every document. */
  value: DocumentScope[];
  onChange: (next: DocumentScope[]) => void;
};

/** The filter button at the end of the tabs: narrows the table by where documents live. */
export function DocumentsFilterMenu({
  value,
  onChange,
}: DocumentsFilterMenuProps) {
  const { t } = useTranslation();
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("navigation:documents.filter.label")}
            className={cn(
              "rounded-full",
              value.length > 0 && "bg-accent text-foreground",
            )}
          />
        }
      >
        <ListFilter aria-hidden />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-48">
        <MenuGroup>
          <MenuGroupLabel>
            {t("navigation:documents.columns.visibility")}
          </MenuGroupLabel>
          {SCOPES.map((scope) => (
            <MenuCheckboxItem
              key={scope}
              checked={value.includes(scope)}
              onCheckedChange={(on) =>
                onChange(
                  on
                    ? [...value, scope]
                    : value.filter((item) => item !== scope),
                )
              }
            >
              {t(`navigation:documents.accessLabel.${scope}`)}
            </MenuCheckboxItem>
          ))}
        </MenuGroup>
        {value.length > 0 && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => onChange([])}>
              {t("navigation:documents.filter.clear")}
            </MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}
