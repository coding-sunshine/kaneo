import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@/components/chat/types";
import { Button } from "@/components/ui/button";

type LinkPreview = NonNullable<ChatMessage["linkPreview"]>;

/** The card under a message for its first web link. */
export function LinkPreviewCard({
  preview,
  onRemove,
}: {
  preview: LinkPreview;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative mt-1 max-w-md rounded-md border border-l-4 bg-muted/40">
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col gap-0.5 p-3 pr-9 text-sm hover:bg-muted/60"
      >
        <span className="text-xs text-muted-foreground">
          {preview.siteName}
        </span>
        <span className="font-medium text-primary">{preview.title}</span>
        {preview.description && (
          <span className="line-clamp-3 text-muted-foreground">
            {preview.description}
          </span>
        )}
      </a>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute top-1 right-1"
          aria-label={t("navigation:chat.removePreview")}
          title={t("navigation:chat.removePreview")}
          onClick={onRemove}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
