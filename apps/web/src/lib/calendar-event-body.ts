import type {
  CalendarProviderId,
  CreateCalendarEventBody,
} from "@/fetchers/calendar-sync/calendar-sync";

export type CalendarEventForm = {
  provider: CalendarProviderId;
  title: string;
  /** YYYY-MM-DD in the browser's time zone. */
  date: string;
  /** HH:mm */
  startTime: string;
  endTime: string;
  allDay: boolean;
  addMeeting: boolean;
  meetingUrl: string;
};

const localInstant = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
};

/** The request body for the form, or null while it cannot be sent. */
export function toCalendarEventBody(
  form: CalendarEventForm,
): CreateCalendarEventBody | null {
  const title = form.title.trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return null;
  const meetingUrl = form.meetingUrl.trim();
  const shared = {
    provider: form.provider,
    title,
    addMeeting: form.addMeeting,
    ...(meetingUrl ? { meetingUrl } : {}),
  };
  if (form.allDay) {
    return { ...shared, allDay: true, start: form.date, end: form.date };
  }
  const start = localInstant(form.date, form.startTime);
  const end = localInstant(form.date, form.endTime);
  if (Number.isNaN(start.getTime()) || !(end > start)) return null;
  return {
    ...shared,
    allDay: false,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
