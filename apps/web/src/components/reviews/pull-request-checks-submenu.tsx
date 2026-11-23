import { ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChecksList } from "@/components/reviews/checks-list";
import { MenuSub, MenuSubPopup, MenuSubTrigger } from "@/components/ui/menu";
import type { PullRef } from "@/fetchers/github-reviews/github-reviews";

/** Checks submenu; the checks load only once it opens. */
export function PullRequestChecksSubmenu({ pullRef }: { pullRef: PullRef }) {
  const { t } = useTranslation();
  return (
    <MenuSub>
      <MenuSubTrigger>
        <ListChecks />
        {t("workspace:reviews.prActions.checks")}
      </MenuSubTrigger>
      <MenuSubPopup
        className="w-80 p-1"
        // Keep menu typeahead off the filter field, but let Escape and arrows through.
        onKeyDown={(event) => {
          if (event.key !== "Escape" && event.key !== "ArrowDown") {
            event.stopPropagation();
          }
        }}
      >
        <ChecksList pullRef={pullRef} />
      </MenuSubPopup>
    </MenuSub>
  );
}
