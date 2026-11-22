export type NotificationSchedule = {
  scheduleEnabled: boolean;
  scheduleTimezone: string;
  scheduleDays: number[];
  scheduleStart: string;
  scheduleEnd: string;
};

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export function isValidTimezone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Whether `now` falls inside the user's delivery window, in their timezone. */
export function isWithinNotificationSchedule(
  schedule: NotificationSchedule,
  now = new Date(),
) {
  if (!schedule.scheduleEnabled) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.scheduleTimezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  const day = WEEKDAYS.indexOf(part("weekday"));
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return (
    schedule.scheduleDays.includes(day) &&
    minutes >= toMinutes(schedule.scheduleStart) &&
    minutes < toMinutes(schedule.scheduleEnd)
  );
}
