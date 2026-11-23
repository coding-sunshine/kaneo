import { Clock } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import useSnoozeNotification from "@/hooks/mutations/notification/use-snooze-notification";
import { formatDate } from "@/lib/format";
import { getSnoozeOptions, parseSnooze } from "./snooze";

export const formatSnoozeDate = (date: Date) =>
  formatDate(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

type ItemProps = {
  className?: string;
  onClick?: () => void;
  children: ReactNode;
};

/** Linear's snooze list: free-text input on top, presets below. */
export function SnoozeRows({
  Item,
  onSnooze,
}: {
  Item: ComponentType<ItemProps>;
  onSnooze: (until: Date) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const custom = parseSnooze(text);

  return (
    <div className="min-w-72">
      <input
        // biome-ignore lint/a11y/noAutofocus: menu opens on a keyboard or click action
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter" && custom) onSnooze(custom);
        }}
        placeholder={t(
          "notifications:inbox.snooze.try",
          "Try: 4 pm, 2 days, in 5 weeks...",
        )}
        className="mb-1 w-full border-border/60 border-b bg-transparent px-2 pt-1 pb-2 text-sm outline-none placeholder:text-muted-foreground/70"
      />
      {custom && (
        <Item className="gap-2" onClick={() => onSnooze(custom)}>
          <Clock className="size-3.5 text-muted-foreground" />
          <span className="flex-1">{text.trim()}</span>
          <span className="text-muted-foreground text-xs">
            {formatSnoozeDate(custom)}
          </span>
        </Item>
      )}
      {getSnoozeOptions().map((option) => (
        <Item
          key={option.id}
          className="gap-2"
          onClick={() => onSnooze(option.date)}
        >
          <Clock className="size-3.5 text-muted-foreground" />
          <span className="flex-1 whitespace-nowrap">{option.label}</span>
          <span className="whitespace-nowrap text-muted-foreground text-xs">
            {formatSnoozeDate(option.date)}
          </span>
        </Item>
      ))}
    </div>
  );
}

export function useSnooze(id: string) {
  const { mutate } = useSnoozeNotification();
  return (until: Date | null) => mutate({ id, until });
}

/** Hover button on an inbox row. */
export function SnoozeButton({ id, label }: { id: string; label: string }) {
  const snooze = useSnooze(id);
  const [open, setOpen] = useState(false);
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        title={label}
        className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Clock aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{label}</span>
      </MenuTrigger>
      <MenuPopup align="end" className="p-1">
        <SnoozeRows
          Item={({ children, ...props }) => (
            <MenuItem {...props}>{children}</MenuItem>
          )}
          onSnooze={(until) => {
            snooze(until);
            setOpen(false);
          }}
        />
      </MenuPopup>
    </Menu>
  );
}
