import type { WorkProjectStatus } from "@/fetchers/work-project/types";

export const WORK_PROJECT_STATUSES: WorkProjectStatus[] = [
  "backlog",
  "planned",
  "started",
  "paused",
  "completed",
  "canceled",
];

export const WORK_PROJECT_HEALTHS = ["onTrack", "atRisk", "offTrack"] as const;

export const DEFAULT_WORK_PROJECT_COLOR = "#bec2c8";

// Linear's project palette.
export const WORK_PROJECT_COLORS = [
  "#bec2c8",
  "#e5484d",
  "#f2994a",
  "#f2c94c",
  "#4cb782",
  "#26b5ce",
  "#5e6ad2",
  "#8b5cf6",
];
