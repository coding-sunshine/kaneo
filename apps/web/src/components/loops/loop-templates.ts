import {
  Bug,
  CircleDot,
  FileText,
  Megaphone,
  MessageCircle,
  type LucideIcon,
  CalendarDays,
} from "lucide-react";

export type LoopFrequency =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";
export type LoopEventTrigger =
  | "task_created"
  | "task_status_changed"
  | "comment_created";
export type LoopTrigger = "schedule" | LoopEventTrigger;
export const LOOP_EVENT_TRIGGERS: LoopEventTrigger[] = [
  "task_created",
  "task_status_changed",
  "comment_created",
];
/** The changes a loop run may make; anything else it can only read. */
export type LoopAction =
  | "create_task"
  | "update_task"
  | "update_task_status"
  | "update_task_assignee"
  | "create_task_comment"
  | "create_project_update";
export const LOOP_ACTIONS: LoopAction[] = [
  "create_task_comment",
  "update_task",
  "update_task_status",
  "update_task_assignee",
  "create_task",
  "create_project_update",
];
export type LoopCategory =
  | "featured"
  | "engineering"
  | "triage"
  | "reporting"
  | "security"
  | "support";

export const LOOP_CATEGORIES: LoopCategory[] = [
  "featured",
  "engineering",
  "triage",
  "reporting",
  "security",
  "support",
];

export const LOOP_FREQUENCIES: LoopFrequency[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

export type LoopTemplate = {
  id: string;
  icon: LucideIcon;
  iconClass: string;
  categories: LoopCategory[];
  actions: LoopAction[];
} & (
  | { trigger: "schedule"; frequency: LoopFrequency }
  | { trigger: LoopEventTrigger; frequency?: undefined }
);

// Copy (title, description, action, instructions) lives under
// navigation:loops.templates.<id>.
export const LOOP_TEMPLATES: LoopTemplate[] = [
  {
    id: "autofix",
    icon: Bug,
    iconClass: "text-sky-500",
    categories: ["featured", "engineering"],
    actions: ["create_task_comment"],
    trigger: "task_created",
  },
  {
    id: "triage",
    icon: CircleDot,
    iconClass: "text-orange-500",
    categories: ["featured", "triage"],
    actions: ["create_task_comment", "update_task", "update_task_assignee"],
    trigger: "task_created",
  },
  {
    id: "qa",
    icon: MessageCircle,
    iconClass: "text-indigo-500",
    categories: ["featured", "support"],
    actions: ["create_task_comment"],
    trigger: "comment_created",
  },
  {
    id: "wrap",
    icon: CalendarDays,
    iconClass: "text-foreground",
    categories: ["featured", "reporting"],
    actions: [],
    trigger: "schedule",
    frequency: "weekly",
  },
  {
    id: "requests",
    icon: FileText,
    iconClass: "text-sky-500",
    categories: ["featured", "reporting"],
    actions: [],
    trigger: "schedule",
    frequency: "weekly",
  },
  {
    id: "priority",
    icon: Megaphone,
    iconClass: "text-orange-500",
    categories: ["featured", "triage"],
    actions: ["update_task", "create_task_comment"],
    trigger: "schedule",
    frequency: "daily",
  },
];
