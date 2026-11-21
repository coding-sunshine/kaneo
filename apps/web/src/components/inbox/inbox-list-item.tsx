import { Clock, MailCheck, MailOpen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getNotificationContent,
  getNotificationTitle,
} from "@/components/notification/notification-text";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import useDeleteNotification from "@/hooks/mutations/notification/use-delete-notification";
import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import useMarkNotificationAsUnread from "@/hooks/mutations/notification/use-mark-notification-as-unread";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { Notification } from "@/types/notification";
import { getEventDataRecord } from "@/components/notification/notification-text";
import { NotificationIcon } from "./notification-icon";
import { isSnoozed } from "./snooze";
import { SnoozeButton, SnoozeRows, useSnooze } from "./snooze-menu";

function shortAge(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units: Array<[string, number]> = [
    ["w", 604800],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u}`;
  return "now";
}

type InboxListItemProps = {
  notification: Notification;
  isSelected: boolean;
  onSelect: (notification: Notification) => void;
};

export function InboxListItem({
  notification,
  isSelected,
  onSelect,
}: InboxListItemProps) {
  const { t } = useTranslation();
  const content = getNotificationContent(notification, t);
  const { mutate: remove } = useDeleteNotification();
  const { mutate: markRead } = useMarkNotificationAsRead();
  const { mutate: markUnread } = useMarkNotificationAsUnread();
  const snooze = useSnooze(notification.id);
  const snoozed = isSnoozed(notification);
  const data = getEventDataRecord(notification.eventData);
  // Linear rows: issue or document title on top, "who did what: snippet" underneath.
  const issueTitle =
    [data?.taskTitle, data?.documentTitle].find(
      (x): x is string => typeof x === "string" && x.length > 0,
    ) ?? null;
  // Previews are raw comment source; drop tags so mentions read as "@name".
  const preview = [data?.commentPreview, data?.mentionPreview]
    .find((x): x is string => typeof x === "string" && x.length > 0)
    ?.replace(/<[^>]+>/g, "");
  const heading = issueTitle ?? getNotificationTitle(notification, t);
  const snippet = issueTitle
    ? [getNotificationTitle(notification, t), preview]
        .filter(Boolean)
        .join(": ")
    : content;

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<li className="group/row relative" />}>
        <button
          type="button"
          data-notification-id={notification.id}
          data-shortcut-surface
          aria-current={isSelected ? "true" : undefined}
          onClick={() => onSelect(notification)}
          className={cn(
            "flex w-full cursor-pointer gap-2.5 rounded-lg px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            isSelected ? "bg-accent" : "hover:bg-accent/50",
          )}
        >
          <NotificationIcon type={notification.type} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              {/* Always takes its slot so titles line up across read and unread rows. */}
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  !notification.isRead && "bg-info",
                )}
              >
                {!notification.isRead && (
                  <span className="sr-only">
                    {t("notifications:inbox.unread")}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px]",
                  notification.isRead
                    ? "text-foreground/80"
                    : "font-semibold text-foreground",
                )}
              >
                {heading}
              </span>
              <time
                dateTime={notification.createdAt}
                title={formatDateTime(notification.createdAt)}
                className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs group-focus-within/row:invisible group-hover/row:invisible"
              >
                {snoozed && <Clock aria-hidden="true" className="size-3" />}
                {shortAge(notification.createdAt)}
              </time>
            </span>
            {snippet && (
              <span
                className={cn(
                  "truncate text-[13px]",
                  notification.isRead
                    ? "text-muted-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {snippet}
              </span>
            )}
          </span>
        </button>
        <span className="absolute top-2 right-3 hidden items-center gap-0.5 focus-within:flex group-hover/row:flex">
          <SnoozeButton
            id={notification.id}
            label={t("notifications:inbox.snooze.label", "Snooze")}
          />
          <button
            type="button"
            title={t("common:actions.delete")}
            onClick={() => remove(notification.id)}
            className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            <span className="sr-only">{t("common:actions.delete")}</span>
          </button>
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={() =>
            notification.isRead
              ? markUnread(notification.id)
              : markRead(notification.id)
          }
        >
          {notification.isRead ? <MailOpen /> : <MailCheck />}
          {notification.isRead
            ? t("notifications:inbox.markUnread", "Mark as unread")
            : t("notifications:inbox.markRead", "Mark as read")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => remove(notification.id)}>
          <Trash2 />
          {t("notifications:inbox.deleteOne", "Delete notification")}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Clock />
            {t("notifications:inbox.snooze.label", "Snooze")}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="p-1">
            <SnoozeRows Item={ContextMenuItem} onSnooze={snooze} />
          </ContextMenuSubContent>
        </ContextMenuSub>
        {snoozed && (
          <ContextMenuItem onClick={() => snooze(null)}>
            <Clock />
            {t("notifications:inbox.snooze.remove", "Remove snooze")}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
