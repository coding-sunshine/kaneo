import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";

/** Linear's copy link control; copies this page's Kaneo URL. */
export function CopyReviewLinkButton() {
  const { t } = useTranslation();
  const label = t("workspace:reviews.detail.menu.copyReviewUrl");
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="shrink-0"
      aria-label={label}
      onClick={() =>
        copyText(
          window.location.href,
          t("workspace:reviews.detail.menu.reviewUrlCopied"),
          t("workspace:reviews.detail.menu.copyFailed"),
        )
      }
    >
      <Link2 />
    </Button>
  );
}
