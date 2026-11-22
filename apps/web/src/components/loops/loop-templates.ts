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
  frequency: LoopFrequency;
};

// Copy (title, description, action, instructions) lives under
// navigation:loops.templates.<id>. Every template runs on a schedule, the
// only trigger Kaneo can fire.
export const LOOP_TEMPLATES: LoopTemplate[] = [
  {
    id: "autofix",
    icon: Bug,
    iconClass: "text-sky-500",
    categories: ["featured", "engineering"],
    frequency: "hourly",
  },
  {
    id: "triage",
    icon: CircleDot,
    iconClass: "text-orange-500",
    categories: ["featured", "triage"],
    frequency: "hourly",
  },
  {
    id: "qa",
    icon: MessageCircle,
    iconClass: "text-indigo-500",
    categories: ["featured", "support"],
    frequency: "hourly",
  },
  {
    id: "wrap",
    icon: CalendarDays,
    iconClass: "text-foreground",
    categories: ["featured", "reporting"],
    frequency: "weekly",
  },
  {
    id: "requests",
    icon: FileText,
    iconClass: "text-sky-500",
    categories: ["featured", "reporting"],
    frequency: "weekly",
  },
  {
    id: "priority",
    icon: Megaphone,
    iconClass: "text-orange-500",
    categories: ["featured", "triage"],
    frequency: "daily",
  },
];
