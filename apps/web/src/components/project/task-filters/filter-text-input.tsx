import { useState } from "react";
import { Input } from "@/components/ui/input";

/** One free-text value, applied with Enter. */
export function FilterTextInput({
  placeholder,
  initial = "",
  onApply,
  isValid = () => true,
}: {
  placeholder: string;
  initial?: string;
  onApply: (value: string) => void;
  isValid?: (value: string) => boolean;
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
        aria-invalid={!!value.trim() && !isValid(value)}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && value.trim() && isValid(value))
            onApply(value.trim());
        }}
      />
    </div>
  );
}
