import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { type LeadTime, leadTimeFromMinutes } from "./lead-time";

export type EventSwitchKey =
  | "taskAssignmentEnabled"
  | "taskCommentEnabled"
  | "taskStatusChangeEnabled"
  | "dueDateReminderEnabled"
  | "topicUpdatesEnabled"
  | "staleItemsEnabled";

export type EventPreferences = Record<EventSwitchKey, boolean> & {
  leadTime: LeadTime;
};

export function toEventPreferences(
  preferences: NotificationPreferences,
): EventPreferences {
  return {
    taskAssignmentEnabled: preferences.taskAssignmentEnabled,
    taskCommentEnabled: preferences.taskCommentEnabled,
    taskStatusChangeEnabled: preferences.taskStatusChangeEnabled,
    dueDateReminderEnabled: preferences.dueDateReminderEnabled,
    topicUpdatesEnabled: preferences.topicUpdatesEnabled,
    staleItemsEnabled: preferences.staleItemsEnabled,
    leadTime: leadTimeFromMinutes(preferences.dueDateReminderLeadTimeMinutes),
  };
}
