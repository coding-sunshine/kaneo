import { CirclePlay, Minus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { cn } from "@/lib/cn";
import { cycleTitle } from "@/lib/cycle/cycle-label";
import { cycleHint, orderCyclesForPicker } from "./cycle-options";

const NONE = "__none__";

type Props = {
  projectId: string;
  cycleId: string | null;
  onChange: (cycleId: string | null) => void;
};

/** Cycle pill for the create modal; hidden when the team has no cycles. */
export function CreateTaskCyclePicker({ projectId, cycleId, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: cycles = [] } = useGetCycles(projectId);
  if (cycles.length === 0) return null;
  const cycle = cycles.find((c) => c.id === cycleId);
  const labels = {
    current: t("tasks:popover.cycle.current"),
    upcoming: t("tasks:popover.cycle.upcoming"),
    previous: t("tasks:popover.cycle.previous"),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-medium text-xs transition-colors hover:bg-accent/50",
            cycle ? "bg-accent/30 text-foreground" : "text-muted-foreground",
          )}
        >
          <CirclePlay className="size-3.5" />
          <span>
            {cycle ? cycleTitle(cycle) : t("tasks:createModal.cycle")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <OptionMenu
          label={t("tasks:createModal.cycle")}
          placeholder={t("tasks:popover.cycle.placeholder")}
          inputHint="⇧ C"
          options={[
            {
              value: NONE,
              label: t("tasks:popover.cycle.none"),
              icon: <Minus className="size-3.5 text-muted-foreground" />,
              selected: !cycle,
              pinned: true,
            },
            ...orderCyclesForPicker(cycles).map(({ cycle: c, state }) => ({
              value: c.id,
              label: cycleTitle(c),
              icon: <CirclePlay className="text-muted-foreground" />,
              hint: cycleHint(c, state, labels),
              selected: c.id === cycleId,
            })),
          ]}
          onSelect={(v) => {
            setOpen(false);
            onChange(v === NONE ? null : v);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
