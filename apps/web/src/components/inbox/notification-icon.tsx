import {
  AtSign,
  Bell,
  CalendarClock,
  CalendarX,
  CircleCheck,
  FileCheck,
  FilePlus,
  FileQuestion,
  FileSymlink,
  Flame,
  History,
  Hourglass,
  Inbox,
  type LucideIcon,
  MessageSquare,
  Newspaper,
  SquarePlus,
  Sunrise,
  Timer,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";

const icons: Record<string, LucideIcon> = {
  task_mention: AtSign,
  task_comment: MessageSquare,
  chat_mention: AtSign,
  chat_direct_message: MessageSquare,
  chat_reminder: Timer,
  document_mention: AtSign,
  document_comment: MessageSquare,
  document_proposed: FilePlus,
  document_current: FileCheck,
  document_decision: FileCheck,
  document_replaced: FileSymlink,
  document_question: FileQuestion,
  document_inbox_waiting: Inbox,
  task_assignee_changed: UserRound,
  task_status_changed: History,
  task_created: SquarePlus,
  due_date_reminder: CalendarClock,
  task_overdue: CalendarX,
  sla_warning: Flame,
  sla_breach: Flame,
  stale_items: Hourglass,
  weekly_digest: Newspaper,
  time_entry_created: Timer,
  team_issue_added: SquarePlus,
  team_issue_closed: CircleCheck,
  team_issue_triage: Inbox,
  daily_brief: Sunrise,
};

export function NotificationIcon({ type }: { type: string }) {
  const Icon = Object.hasOwn(icons, type) ? icons[type] : Bell;

  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        type === "task_overdue"
          ? "bg-destructive/10 text-destructive-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </span>
  );
}
