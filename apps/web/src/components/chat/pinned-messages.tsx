import { Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePins } from "@/hooks/queries/chat/use-pins";

/** The channel's pinned messages, newest pin first, for every reader. */
export function PinnedMessages({
  workspaceId,
  channelId,
}: {
  workspaceId: string;
  channelId: string;
}) {
  const { t } = useTranslation();
  const { data: pins = [] } = usePins(workspaceId, channelId, true);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="xs" />}
        aria-label={t("navigation:chat.pinned")}
      >
        <Pin />
        {pins.length > 0 && <span className="tabular-nums">{pins.length}</span>}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-80">
        <PopoverTitle className="text-sm">
          {t("navigation:chat.pinned")}
        </PopoverTitle>
        {pins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("navigation:chat.noPins")}
          </p>
        ) : (
          <ul
            className="flex max-h-80 flex-col gap-3 overflow-y-auto"
            aria-label={t("navigation:chat.pinned")}
          >
            {pins.map((pin) => (
              <li key={pin.id} className="flex flex-col gap-0.5 text-sm">
                <span className="text-xs font-medium">
                  {pin.authorName ?? t("navigation:chat.deletedUser")}
                </span>
                <p className="line-clamp-3 whitespace-pre-wrap break-words">
                  {pin.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverPopup>
    </Popover>
  );
}
