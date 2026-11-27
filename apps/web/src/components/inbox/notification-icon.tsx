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
  Inbox,
  type LucideIcon,
  MessageSquare,
  SquarePlus,
  Timer,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";

const icons: Record<string, LucideIcon> = {
  task_mention: AtSign,
  task_comment: MessageSquare,
  document_mention: AtSign,
  document_comment: MessageSquare,
  document_proposed: FilePlus,
  document_current: FileCheck,
  document_decision: FileCheck,
  document_replaced: FileSymlink,
  document_question: FileQuestion,
  task_assignee_changed: UserRound,
  task_status_changed: History,
  task_created: SquarePlus,
  due_date_reminder: CalendarClock,
  task_overdue: CalendarX,
  sla_warning: Flame,
  sla_breach: Flame,
  time_entry_created: Timer,
  team_issue_added: SquarePlus,
  team_issue_closed: CircleCheck,
  team_issue_triage: Inbox,
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
