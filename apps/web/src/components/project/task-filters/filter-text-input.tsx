import { useState } from "react";
import { Input } from "@/components/ui/input";

/** One free-text value, applied with Enter. */
export function FilterTextInput({
  placeholder,
  initial = "",
  onApply,
}: {
  placeholder: string;
  initial?: string;
  onApply: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="p-1">
      <Input
        autoFocus
        size="sm"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim()) onApply(value.trim());
        }}
      />
    </div>
  );
}
