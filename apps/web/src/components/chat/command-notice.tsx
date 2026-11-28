import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** What a slash command did, shown above the composer to its sender only. */
export function CommandNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 border-t bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
      <p role="status" className="min-w-0 flex-1">
        {message}
      </p>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={t("navigation:chat.commands.dismiss")}
        onClick={onDismiss}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
