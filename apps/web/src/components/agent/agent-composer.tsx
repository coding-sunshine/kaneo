import { ArrowUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

type AgentComposerProps = {
  placeholder: string;
  pending?: boolean;
  onSubmit: (message: string) => void;
  initialValue?: string;
};

/** Linear's rounded prompt box: textarea with a round send button. */
export function AgentComposer({
  placeholder,
  pending,
  onSubmit,
  initialValue = "",
}: AgentComposerProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const message = value.trim();
    if (!message || pending) return;
    onSubmit(message);
    setValue("");
  };

  return (
    <div className="flex flex-col rounded-xl border border-border/80 bg-card shadow-xs/5">
      <textarea
        autoFocus
        rows={2}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-16 w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] outline-none placeholder:text-muted-foreground/70"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2 px-3 pb-3">
        <button
          type="button"
          aria-label={t("navigation:agent.send")}
          disabled={!value.trim() || pending}
          onClick={submit}
          className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          {pending ? (
            <Spinner className="size-3" />
          ) : (
            <ArrowUp className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
