import { format } from "date-fns";
import { type JSX, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalendarProviderId } from "@/fetchers/calendar-sync/calendar-sync";
import { useCreateCalendarEvent } from "@/hooks/mutations/calendar-sync/use-create-calendar-event";
import {
  type CalendarEventForm,
  toCalendarEventBody,
} from "@/lib/calendar-event-body";
import { toast } from "@/lib/toast";

const PROVIDER_LABEL = {
  google: "settings:calendarSync.providers.google",
  microsoft: "settings:calendarSync.providers.microsoft",
} as const;

const MEETING_LABEL = {
  google: "tasks:calendar.createEvent.addMeeting.google",
  microsoft: "tasks:calendar.createEvent.addMeeting.microsoft",
} as const;

type CreateCalendarEventDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Connected calendars, at least one. */
  providers: readonly CalendarProviderId[];
};

const emptyForm = (provider: CalendarProviderId): CalendarEventForm => ({
  provider,
  title: "",
  date: format(new Date(), "yyyy-MM-dd"),
  startTime: "09:00",
  endTime: "09:30",
  allDay: false,
  addMeeting: true,
  meetingUrl: "",
});

export default function CreateCalendarEventDialog({
  open,
  onOpenChange,
  providers,
}: CreateCalendarEventDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => emptyForm(providers[0] ?? "google"));
  const create = useCreateCalendarEvent();
  const ids = { title: useId(), date: useId(), start: useId(), end: useId() };
  const allDayId = useId();
  const meetingId = useId();
  const linkId = useId();
  const body = toCalendarEventBody(form);
  const update = (patch: Partial<CalendarEventForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  const save = () => {
    if (!body || create.isPending) return;
    create.mutate(body, {
      onSuccess: () => {
        toast.success(t("tasks:calendar.createEvent.created"));
        setForm(emptyForm(form.provider));
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("tasks:calendar.createEvent.title")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-3">
          {providers.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("tasks:calendar.createEvent.calendar")}</Label>
              <Select
                value={form.provider}
                onValueChange={(value) =>
                  update({ provider: value as CalendarProviderId })
                }
              >
                <SelectTrigger
                  aria-label={t("tasks:calendar.createEvent.calendar")}
                  size="sm"
                >
                  <SelectValue>{t(PROVIDER_LABEL[form.provider])}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {t(PROVIDER_LABEL[provider])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.title}>
              {t("tasks:calendar.createEvent.eventTitle")}
            </Label>
            <Input
              id={ids.title}
              autoFocus
              value={form.title}
              maxLength={1024}
              placeholder={t("tasks:calendar.createEvent.titlePlaceholder")}
              onChange={(event) => update({ title: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <Label htmlFor={ids.date}>
                {t("tasks:calendar.createEvent.date")}
              </Label>
              <Input
                id={ids.date}
                type="date"
                value={form.date}
                onChange={(event) => update({ date: event.target.value })}
              />
            </div>
            {!form.allDay && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.start}>
                    {t("tasks:calendar.createEvent.startTime")}
                  </Label>
                  <Input
                    id={ids.start}
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      update({ startTime: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.end}>
                    {t("tasks:calendar.createEvent.endTime")}
                  </Label>
                  <Input
                    id={ids.end}
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                      update({ endTime: event.target.value })
                    }
                  />
                </div>
              </>
            )}
          </div>
          <Label htmlFor={allDayId} className="flex items-center gap-2">
            <Checkbox
              id={allDayId}
              checked={form.allDay}
              onCheckedChange={(checked) => update({ allDay: checked })}
            />
            {t("tasks:calendar.createEvent.allDay")}
          </Label>
          <Label htmlFor={meetingId} className="flex items-center gap-2">
            <Checkbox
              id={meetingId}
              checked={form.addMeeting}
              onCheckedChange={(checked) =>
                update({ addMeeting: checked, meetingUrl: "" })
              }
            />
            {t(MEETING_LABEL[form.provider])}
          </Label>
          {!form.addMeeting && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={linkId}>
                {t("tasks:calendar.createEvent.meetingUrl")}
              </Label>
              <Input
                id={linkId}
                type="url"
                inputMode="url"
                value={form.meetingUrl}
                placeholder={t(
                  "tasks:calendar.createEvent.meetingUrlPlaceholder",
                )}
                onChange={(event) => update({ meetingUrl: event.target.value })}
              />
            </div>
          )}
          {!body && form.title.trim() !== "" && (
            <p role="alert" className="text-xs text-destructive">
              {t("tasks:calendar.createEvent.invalid")}
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button size="sm" disabled={!body || create.isPending} onClick={save}>
            {t("tasks:calendar.createEvent.create")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
