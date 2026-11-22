import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";

type MatchModeMenuProps = {
  matchAny: boolean;
  onChange: (matchAny: boolean) => void;
};

/** "Match all filters / any filter": how the active filters combine. */
export function MatchModeMenu({ matchAny, onChange }: MatchModeMenuProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="h-7 shrink-0 rounded-md px-2 text-[13px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent data-popup-open:bg-accent"
          />
        }
      >
        {t("tasks:filterBar.matchLabel")}{" "}
        {matchAny
          ? t("tasks:filterBar.matchAny")
          : t("tasks:filterBar.matchAll")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        <DropdownMenuRadioGroup
          value={matchAny ? "any" : "all"}
          onValueChange={(value) => onChange(value === "any")}
        >
          <DropdownMenuRadioItem value="all" closeOnClick>
            {t("tasks:filterBar.matchAll")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="any" closeOnClick>
            {t("tasks:filterBar.matchAny")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
