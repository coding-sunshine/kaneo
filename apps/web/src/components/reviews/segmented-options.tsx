import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** An optional title over a row of pressed/unpressed buttons, one per value. */
export function SegmentedOptions<T extends string>({
  values,
  value,
  text,
  title,
  lead,
  onChange,
}: {
  values: readonly T[];
  value: T;
  text: (value: T) => string;
  title?: string;
  /** Shown before the buttons, such as a direction toggle. */
  lead?: ReactNode;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {title && <span>{title}</span>}
      <div className="flex items-center gap-1.5">
        {lead}
        <div
          role="group"
          className="grid flex-1 auto-cols-fr grid-flow-col gap-1.5"
        >
          {values.map((item) => (
            <Button
              key={item}
              size="xs"
              variant="outline"
              aria-pressed={value === item}
              onClick={() => onChange(item)}
              className={value === item ? "bg-accent" : "text-muted-foreground"}
            >
              {text(item)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
