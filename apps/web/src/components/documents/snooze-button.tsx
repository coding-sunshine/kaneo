import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";

const DAY = 86_400_000;
/** A local day as a date input writes it: YYYY-MM-DD. */
const inputDate = (daysAhead: number) => {
  const day = new Date(Date.now() + daysAhead * DAY);
  day.setMinutes(day.getMinutes() - day.getTimezoneOffset());
  return day.toISOString().slice(0, 10);
};

type SnoozeButtonProps = {
  /** Called with the start of the day picked, as an ISO time. */
  onSnooze: (until: string) => void;
  disabled?: boolean;
};

/** Picks the day an Inbox item comes back; a week ahead unless changed. */
export function SnoozeButton({ onSnooze, disabled }: SnoozeButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => inputDate(7));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!date) return;
    onSnooze(new Date(`${date}T00:00`).toISOString());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        {t("navigation:documents.inbox.snooze")}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-auto">
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            type="date"
            required
            aria-label={t("navigation:documents.inbox.snoozeUntil")}
            min={inputDate(1)}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-[13px]"
          />
          <Button type="submit" size="xs">
            {t("navigation:documents.inbox.confirm")}
          </Button>
        </form>
      </PopoverPopup>
    </Popover>
  );
}
