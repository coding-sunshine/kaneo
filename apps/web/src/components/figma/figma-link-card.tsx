import { Frame, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useRefreshFigmaPreview from "@/hooks/mutations/figma/use-refresh-figma-preview";
import useFigmaPreview from "@/hooks/queries/figma/use-figma-preview";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/** A Figma link's card: thumbnail, file and frame name, and when it was read. */
export function FigmaLinkCard({
  workspaceId,
  url,
}: {
  workspaceId: string;
  url: string;
}) {
  const { t, i18n } = useTranslation();
  const { data: preview } = useFigmaPreview(workspaceId, url);
  const refresh = useRefreshFigmaPreview();
  const [brokenThumbnail, setBrokenThumbnail] = useState<string | null>(null);

  // Loading or failed: the link in the text is enough.
  if (!preview) return null;
  const thumbnail =
    preview.thumbnailUrl && preview.thumbnailUrl !== brokenThumbnail
      ? preview.thumbnailUrl
      : null;

  return (
    <div className="relative flex max-w-md overflow-hidden rounded-md border bg-muted/40">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("tasks:figma.open", { name: preview.fileName })}
        className="flex min-w-0 flex-1 items-center gap-3 p-2 pr-10 text-sm hover:bg-muted/60"
      >
        <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={() => setBrokenThumbnail(thumbnail)}
            />
          ) : (
            <Frame className="size-5 text-muted-foreground" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{preview.fileName}</span>
          {preview.frameName && (
            <span className="truncate text-muted-foreground">
              {preview.frameName}
            </span>
          )}
          <time
            dateTime={preview.fetchedAt}
            title={formatDateTime(preview.fetchedAt, i18n.language)}
            className="text-xs text-muted-foreground"
          >
            {t("tasks:figma.fetchedAt", {
              time: formatRelativeTime(preview.fetchedAt, i18n.language),
            })}
          </time>
        </span>
      </a>
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute top-1 right-1"
        aria-label={t("tasks:figma.refresh")}
        title={t("tasks:figma.refresh")}
        disabled={refresh.isPending}
        onClick={() => refresh.mutate({ workspaceId, url })}
      >
        <RefreshCw className={cn(refresh.isPending && "animate-spin")} />
      </Button>
    </div>
  );
}
