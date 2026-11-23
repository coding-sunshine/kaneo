import { Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatSnoozeDate } from "@/components/inbox/snooze-menu";
import { getSnoozeOptions, parseSnooze } from "@/components/inbox/snooze";
import { Button } from "@/components/ui/button";
import {
  MenuItem,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/components/ui/menu";
import { formatDate } from "@/lib/format";
import { pullRequestKey } from "@/lib/pull-request-key";
import { entryFor, isSnoozed, type SnoozeMode } from "@/lib/reviews-snooze";
import { toast } from "@/lib/toast";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";

type SnoozablePull = {
  owner: string;
  repo: string;
  number: number;
  updatedAt: string;
  comments: number;
};

const MODES: { mode: SnoozeMode; key: string }[] = [
  { mode: "newComment", key: "untilComment" },
  { mode: "newReview", key: "untilReview" },
];

/** Linear's Snooze submenu (Change snooze plus Unsnooze once snoozed). */
export function PullRequestSnoozeSubmenu({ pull }: { pull: SnoozablePull }) {
  const { t } = useTranslation();
  const key = pullRequestKey({ ...pull, number: String(pull.number) });
  const entry = useReviewsSnoozeStore((state) => state.entries[key]);
  const { snooze, unsnooze } = useReviewsSnoozeStore.getState();
  const snoozed = isSnoozed(entry, pull);
  const [text, setText] = useState("");
  const [custom, setCustom] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const typed = parseSnooze(text);

  const until = (date: Date) => {
    snooze(key, entryFor(pull, { until: date }));
    toast.success(
      t("workspace:reviews.snooze.snoozed", {
        date: formatDate(date, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      }),
    );
  };

  const row = (label: string, date: Date) => (
    <MenuItem key={label} className="gap-2" onClick={() => until(date)}>
      <Clock className="text-muted-foreground" />
      <span className="flex-1 whitespace-nowrap">{label}</span>
      <span className="whitespace-nowrap text-muted-foreground text-xs">
        {formatSnoozeDate(date)}
      </span>
    </MenuItem>
  );

  return (
    <>
      <MenuSub>
        <MenuSubTrigger>
          <Clock />
          {t(
            snoozed
              ? "workspace:reviews.snooze.change"
              : "workspace:reviews.snooze.label",
          )}
        </MenuSubTrigger>
        <MenuSubPopup className="min-w-80 p-1">
          <input
            // biome-ignore lint/a11y/noAutofocus: the submenu opens on a keyboard or click action
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              // Keep menu typeahead and arrow handling off the text field.
              if (event.key !== "Escape" && event.key !== "ArrowDown") {
                event.stopPropagation();
              }
              if (event.key === "Enter" && typed) until(typed);
            }}
            placeholder={t("workspace:reviews.snooze.placeholder")}
            aria-label={t("workspace:reviews.snooze.placeholder")}
            className="mb-1 w-full border-border/60 border-b bg-transparent px-2 pt-1 pb-2 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {typed && row(text.trim(), typed)}
          {MODES.map(({ mode, key: labelKey }) => (
            <MenuItem
              key={mode}
              className="gap-2"
              onClick={() => snooze(key, entryFor(pull, { mode }))}
            >
              <Clock className="text-muted-foreground" />
              {t(`workspace:reviews.snooze.${labelKey}`)}
            </MenuItem>
          ))}
          {getSnoozeOptions().map((option) =>
            row(t(`workspace:reviews.snooze.${option.id}`), option.date),
          )}
          <MenuItem
            className="gap-2"
            closeOnClick={false}
            onClick={() => setCustomOpen((open) => !open)}
          >
            <Clock className="text-muted-foreground" />
            {t("workspace:reviews.snooze.custom")}
          </MenuItem>
          {customOpen && (
            <div className="flex items-center gap-2 px-2 pt-1 pb-1">
              <input
                type="datetime-local"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label={t("workspace:reviews.snooze.customLabel")}
                className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-sm"
              />
              <Button
                size="xs"
                disabled={!custom || new Date(custom) <= new Date()}
                onClick={() => until(new Date(custom))}
              >
                {t("workspace:reviews.snooze.customSet")}
              </Button>
            </div>
          )}
        </MenuSubPopup>
      </MenuSub>
      {snoozed && (
        <MenuItem
          onClick={() => {
            unsnooze(key);
            toast.success(t("workspace:reviews.snooze.unsnoozed"));
          }}
        >
          <Clock />
          {t("workspace:reviews.snooze.unsnooze")}
        </MenuItem>
      )}
    </>
  );
}
