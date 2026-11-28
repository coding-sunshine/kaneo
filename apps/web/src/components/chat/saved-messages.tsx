import { Link } from "@tanstack/react-router";
import { Bookmark, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSaveMessage } from "@/hooks/mutations/chat/use-later-mutations";
import { useSavedMessages } from "@/hooks/queries/chat/use-saved-messages";
import { toast } from "@/lib/toast";

/**
 * The caller's own saved messages across the workspace, newest save first.
 * Removing one takes it off the list and leaves it in its channel.
 */
export function SavedMessages({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: saved = [] } = useSavedMessages(workspaceId);
  const save = useSaveMessage(workspaceId);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="xs" />}
        aria-label={t("navigation:chat.saved")}
      >
        <Bookmark />
        {saved.length > 0 && (
          <span className="tabular-nums">{saved.length}</span>
        )}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-80">
        <PopoverTitle className="text-sm">
          {t("navigation:chat.saved")}
        </PopoverTitle>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("navigation:chat.noSaved")}
          </p>
        ) : (
          <ul
            className="flex max-h-80 flex-col gap-3 overflow-y-auto"
            aria-label={t("navigation:chat.saved")}
          >
            {saved.map((message) => (
              <li key={message.id} className="flex gap-2 text-sm">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-medium">
                    {message.authorName ?? t("navigation:chat.deletedUser")}
                  </span>
                  <p className="line-clamp-3 whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <Link
                    to="/dashboard/workspace/$workspaceId/channels/$channelId"
                    params={{ workspaceId, channelId: message.channelId }}
                    search={{ messageId: message.id }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {t("navigation:chat.openSaved")}
                  </Link>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("navigation:chat.unsaveMessage")}
                  onClick={() =>
                    save.mutate(
                      {
                        workspaceId,
                        channelId: message.channelId,
                        messageId: message.id,
                        saved: false,
                      },
                      { onError: (error: Error) => toast.error(error.message) },
                    )
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverPopup>
    </Popover>
  );
}
