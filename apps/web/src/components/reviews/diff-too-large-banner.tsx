import { CircleAlert, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Linear's notice when GitHub cannot return every commit of a very large pull request. */
export function DiffTooLargeBanner({
  url,
  shown,
}: {
  url: string;
  shown: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px]"
    >
      <CircleAlert
        aria-hidden
        className="size-4 shrink-0 text-warning-foreground"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("workspace:reviews.detail.tooLarge")}</p>
        <p className="text-muted-foreground">
          {t("workspace:reviews.detail.tooLargeBody", { count: shown })}
        </p>
      </div>
      <Button
        size="xs"
        variant="outline"
        render={<a href={url} target="_blank" rel="noopener noreferrer" />}
      >
        {t("workspace:reviews.detail.openOnGithub")}
        <ExternalLink />
      </Button>
    </div>
  );
}
