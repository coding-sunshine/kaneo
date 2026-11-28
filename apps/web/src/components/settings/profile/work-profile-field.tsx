import { useEffect, useState } from "react";
import { SettingsRow } from "@/components/settings/settings-row";
import { Input } from "@/components/ui/input";

type WorkProfileFieldProps = {
  label: string;
  placeholder: string;
  value: string | null | undefined;
  onSave: (value: string) => void;
};

/** One free-text profile field, saved when it loses focus. */
export function WorkProfileField({
  label,
  placeholder,
  value,
  onSave,
}: WorkProfileFieldProps) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  return (
    <SettingsRow stack title={label}>
      <Input
        size="sm"
        className="sm:w-64"
        aria-label={label}
        placeholder={placeholder}
        maxLength={100}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() !== (value ?? "")) onSave(draft);
        }}
      />
    </SettingsRow>
  );
}
