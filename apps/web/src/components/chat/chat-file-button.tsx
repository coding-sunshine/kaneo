import { Paperclip } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Opens the file picker; the chosen files go to `onPick`. */
export function ChatFileButton({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (files: File[]) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onPick(files);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={t("navigation:chat.attachFile")}
        title={t("navigation:chat.attachFile")}
        onClick={() => input.current?.click()}
      >
        <Paperclip aria-hidden="true" />
      </Button>
    </>
  );
}
