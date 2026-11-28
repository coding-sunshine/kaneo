import { Check, Copy } from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCodeTokens } from "@/components/chat/use-code-tokens";
import { toast } from "@/lib/toast";

/** A fenced code block: monospaced, coloured once shiki loads, copyable. */
export function MessageCodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const { t } = useTranslation();
  const tokens = useCodeTokens(code, language);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("navigation:chat.copyCodeFailed"));
    }
  };
  return (
    <div className="group/code relative my-1">
      {/* The button sits outside <pre> so copying the message leaves it out. */}
      <button
        type="button"
        aria-label={t("navigation:chat.copyCode")}
        title={t("navigation:chat.copyCode")}
        onClick={copy}
        className="absolute top-1 right-1 rounded p-1 text-muted-foreground opacity-0 hover:bg-accent focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-2 pr-8 font-mono text-xs">
        <code className={language ? `language-${language}` : undefined}>
          {tokens
            ? tokens.map((line, row) => (
                // Lines never reorder, so the row is a stable key.
                // oxlint-disable-next-line react/no-array-index-key
                <Fragment key={row}>
                  {row > 0 && "\n"}
                  {line.map((token, at) => (
                    <span
                      // oxlint-disable-next-line react/no-array-index-key
                      key={at}
                      style={token.color ? { color: token.color } : undefined}
                    >
                      {token.content}
                    </span>
                  ))}
                </Fragment>
              ))
            : code}
        </code>
      </pre>
    </div>
  );
}
