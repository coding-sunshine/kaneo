import {
  CheckCheck,
  Ellipsis,
  Inbox,
  ListFilter,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import useClearNotifications from "@/hooks/mutations/notification/use-clear-notifications";
import useClearReadNotifications from "@/hooks/mutations/notification/use-clear-read-notifications";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import { useInboxDisplayStore } from "@/store/inbox-display";
import type { Notification } from "@/types/notification";
import {
  filterNotifications,
  groupNotifications,
  type InboxFilter,
  NOTIFICATION_TYPE_FILTERS,
} from "./group-notifications";
import { InboxListItem } from "./inbox-list-item";
import { isSnoozed } from "./snooze";
import { useInboxShortcuts } from "./use-inbox-shortcuts";

type InboxListProps = {
  workspaceId: string;
  notifications: Notification[];
  selectedId: string | undefined;
  onSelect: (notification: Notification) => void;
};

export function InboxList({
  workspaceId,
  notifications,
  selectedId,
  onSelect,
}: InboxListProps) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead(workspaceId);
  const { mutate: clearAll } = useClearNotifications(workspaceId);

  const { mutate: clearRead } = useClearReadNotifications(workspaceId);
  const display = useInboxDisplayStore();
  const [types, setTypes] = useState<string[]>([]);

  // Snoozed rows leave the inbox (and its unread count) until the snooze ends.
  const visible = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (display.showSnoozed || !isSnoozed(n)) &&
          (types.length === 0 || types.includes(n.type)),
      ),
    [notifications, display.showSnoozed, types],
  );
  const unreadCount = visible.filter((n) => !n.isRead).length;
  const { today, earlier } = useMemo(() => {
    const sorted = [...filterNotifications(visible, filter)].sort(
      (a, b) =>
        (display.showUnreadFirst
          ? Number(!!a.isRead) - Number(!!b.isRead)
          : 0) ||
        (display.ordering === "newest" ? -1 : 1) *
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    );
    return groupNotifications(sorted, new Date(day));
  }, [visible, filter, day, display.ordering, display.showUnreadFirst]);

  const filters: Array<{ value: InboxFilter; label: string; count?: number }> =
    [
      { value: "all", label: t("notifications:inbox.filters.all") },
      {
        value: "unread",
        label: t("notifications:inbox.filters.unread"),
        count: unreadCount,
      },
      { value: "mentions", label: t("notifications:inbox.filters.mentions") },
    ];

  const groups = [
    { id: "today", title: t("notifications:inbox.today"), items: today },
    { id: "earlier", title: t("notifications:inbox.earlier"), items: earlier },
  ].filter((group) => group.items.length > 0);

  useInboxShortcuts({
    workspaceId,
    notifications,
    order: [...today, ...earlier],
    selectedId,
    onSelect,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-border/60 border-b px-3">
        <fieldset className="inline-flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
          <legend className="sr-only">
            {t("notifications:inbox.filters.label")}
          </legend>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "flex h-6.5 cursor-pointer items-center gap-1.5 rounded-md px-2.5 font-medium text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                filter === option.value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              {option.count ? (
                <span className="font-normal text-muted-foreground text-xs tabular-nums">
                  {option.count}
                </span>
              ) : null}
            </button>
          ))}
        </fieldset>
        <div className="flex items-center gap-0.5 text-muted-foreground">
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="icon-xs" />}
              title={t("notifications:inbox.filter", "Filter")}
            >
              <ListFilter />
              <span className="sr-only">
                {t("notifications:inbox.filter", "Filter")}
              </span>
            </MenuTrigger>
            <MenuPopup align="end" className="min-w-52">
              <MenuSub>
                <MenuSubTrigger>
                  {t(
                    "notifications:inbox.notificationType",
                    "Notification type",
                  )}
                </MenuSubTrigger>
                <MenuSubPopup>
                  {NOTIFICATION_TYPE_FILTERS.map((option) => (
                    <MenuCheckboxItem
                      key={option.label}
                      checked={option.types.every((x) => types.includes(x))}
                      onCheckedChange={(checked) =>
                        setTypes((current) =>
                          checked
                            ? [...current, ...option.types]
                            : current.filter((x) => !option.types.includes(x)),
                        )
                      }
                    >
                      {option.label}
                    </MenuCheckboxItem>
                  ))}
                </MenuSubPopup>
              </MenuSub>
              {types.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={() => setTypes([])}>
                    {t("notifications:inbox.clearFilters", "Clear filters")}
                  </MenuItem>
                </>
              )}
            </MenuPopup>
          </Menu>
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="icon-xs" />}
              title={t("notifications:inbox.display", "Display options")}
            >
              <SlidersHorizontal />
              <span className="sr-only">
                {t("notifications:inbox.display", "Display options")}
              </span>
            </MenuTrigger>
            <MenuPopup align="end" className="min-w-56">
              <MenuSub>
                <MenuSubTrigger>
                  {t("notifications:inbox.ordering", "Ordering")}
                  <span className="ms-auto text-muted-foreground text-xs">
                    {display.ordering === "newest"
                      ? t("notifications:inbox.newest", "Newest")
                      : t("notifications:inbox.oldest", "Oldest")}
                  </span>
                </MenuSubTrigger>
                <MenuSubPopup>
                  <MenuRadioGroup
                    value={display.ordering}
                    onValueChange={(value) =>
                      display.set({ ordering: value as "newest" | "oldest" })
                    }
                  >
                    <MenuRadioItem value="newest">
                      {t("notifications:inbox.newest", "Newest")}
                    </MenuRadioItem>
                    <MenuRadioItem value="oldest">
                      {t("notifications:inbox.oldest", "Oldest")}
                    </MenuRadioItem>
                  </MenuRadioGroup>
                </MenuSubPopup>
              </MenuSub>
              <MenuSeparator />
              <MenuCheckboxItem
                variant="switch"
                checked={display.showSnoozed}
                onCheckedChange={(showSnoozed) => display.set({ showSnoozed })}
              >
                {t("notifications:inbox.showSnoozed", "Show snoozed")}
              </MenuCheckboxItem>
              <MenuCheckboxItem
                variant="switch"
                checked={display.showUnreadFirst}
                onCheckedChange={(showUnreadFirst) =>
                  display.set({ showUnreadFirst })
                }
              >
                {t("notifications:inbox.showUnreadFirst", "Show unread first")}
              </MenuCheckboxItem>
            </MenuPopup>
          </Menu>
          <Menu>
            <MenuTrigger
              render={<Button variant="ghost" size="icon-xs" />}
              title={t("notifications:inbox.moreActions", "More")}
            >
              <Ellipsis />
              <span className="sr-only">
                {t("notifications:inbox.moreActions", "More")}
              </span>
            </MenuTrigger>
            <MenuPopup align="end" className="min-w-56">
              <MenuItem
                disabled={unreadCount === 0}
                onClick={() => markAllAsRead()}
              >
                <CheckCheck />
                {t("common:actions.markAllRead")}
                <MenuShortcut>⌥U</MenuShortcut>
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                disabled={notifications.length === 0}
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 />
                {t("notifications:clearAll")}
              </MenuItem>
              <MenuItem
                disabled={!notifications.some((n) => n.isRead)}
                onClick={() => clearRead()}
              >
                <Trash2 />
                {t("notifications:inbox.deleteAllRead", "Delete all read")}
                <MenuShortcut>⇧⌫</MenuShortcut>
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <Inbox className="mb-1 size-5 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              {notifications.length === 0
                ? t("notifications:emptyTitle")
                : t("notifications:inbox.emptyFilter")}
            </p>
            {notifications.length === 0 && (
              <p className="text-muted-foreground/70 text-xs">
                {t("notifications:emptySubtitle")}
              </p>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.id}>
              <ul className="flex flex-col gap-0.5 px-2">
                {group.items.map((notification) => (
                  <InboxListItem
                    key={notification.id}
                    notification={notification}
                    isSelected={notification.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("notifications:clearDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("notifications:clearDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => clearAll()}
                />
              }
            >
              {t("common:actions.clearAll")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
