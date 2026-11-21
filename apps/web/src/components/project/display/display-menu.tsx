import { SlidersHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ShortcutTooltipLabel } from "@/components/shortcuts/shortcut-tooltip-label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

export const OPEN_DISPLAY_OPTIONS = "kaneo:open-display-options";

export function DisplayMenu({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const title = t("tasks:display.title");
  const [open, setOpen] = useState(false);
  useShortcut("showDisplayOptions", () => setOpen((value) => !value));
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener(OPEN_DISPLAY_OPTIONS, openMenu);
    return () => window.removeEventListener(OPEN_DISPLAY_OPTIONS, openMenu);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={title}
                  className="data-popup-open:bg-accent"
                />
              }
            />
          }
        >
          <SlidersHorizontal />
          <span className="hidden lg:inline">{title}</span>
        </TooltipTrigger>
        <TooltipContent>
          <ShortcutTooltipLabel label={title} shortcutId="showDisplayOptions" />
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <PopoverTitle className="sr-only">{title}</PopoverTitle>
        <div className="-mx-1 divide-y divide-border">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
