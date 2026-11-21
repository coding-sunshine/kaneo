import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getNotificationContent,
  getNotificationTitle,
} from "@/components/notification/notification-text";
import useDeleteNotification from "@/hooks/mutations/notification/use-delete-notification";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/types/notification";
import { NotificationIcon } from "./notification-icon";

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

  return (
    <li className="group/row relative">
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
              {getNotificationTitle(notification, t)}
            </span>
            <time
              dateTime={notification.createdAt}
              title={formatDateTime(notification.createdAt)}
              className="shrink-0 text-muted-foreground text-xs group-focus-within/row:invisible group-hover/row:invisible"
            >
              {formatRelativeTime(notification.createdAt)}
            </time>
          </span>
          {content && (
            <span
              className={cn(
                "truncate text-[13px]",
                notification.isRead
                  ? "text-muted-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              {content}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        title={t("common:actions.delete")}
        onClick={() => remove(notification.id)}
        className="absolute top-2 right-3 hidden size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:flex focus-visible:ring-2 focus-visible:ring-ring group-hover/row:flex"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{t("common:actions.delete")}</span>
      </button>
    </li>
  );
}
