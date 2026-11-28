export type ReminderChoice = "inOneHour" | "tomorrow" | "nextWeek";

const atNine = (date: Date, addDays: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + addDays, 9);

/**
 * The instants behind each Remind me choice, in the viewer's own time zone:
 * an hour from now, tomorrow at 9:00, and next Monday at 9:00.
 */
export function reminderTimes(now: Date): Record<ReminderChoice, Date> {
  const daysToMonday = (8 - now.getDay()) % 7 || 7;
  return {
    inOneHour: new Date(now.getTime() + 60 * 60_000),
    tomorrow: atNine(now, 1),
    nextWeek: atNine(now, daysToMonday),
  };
}
