import { useTranslation } from "react-i18next";
import { type DiffPart, wordDiff } from "./word-diff";

// Each part keyed by where it starts in the before and after texts.
function keyed(parts: DiffPart[]) {
  let before = 0;
  let after = 0;
  return parts.map((part) => {
    const key = `${part.kind}-${before}-${after}`;
    if (part.kind !== "added") before += part.text.length;
    if (part.kind !== "removed") after += part.text.length;
    return { ...part, key };
  });
}

/** The original and the proposed text word by word: removed struck, added marked. */
export function WritingDiff({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const { t } = useTranslation();
  return (
    <p
      aria-label={t("navigation:documents.writing.diff")}
      className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed"
    >
      {keyed(wordDiff(before, after)).map(({ key, ...part }) =>
        part.kind === "same" ? (
          <span key={key}>{part.text}</span>
        ) : part.kind === "removed" ? (
          <del
            key={key}
            className="bg-destructive/10 text-destructive line-through"
          >
            {part.text}
          </del>
        ) : (
          <ins
            key={key}
            className="bg-emerald-500/15 text-emerald-700 no-underline dark:text-emerald-300"
          >
            {part.text}
          </ins>
        ),
      )}
    </p>
  );
}
