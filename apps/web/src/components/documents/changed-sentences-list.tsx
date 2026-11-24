import { useTranslation } from "react-i18next";
import type { changedSentences } from "./changed-sentences";

type ChangedSentencesProps = { changes: ReturnType<typeof changedSentences> };

/** The sentences a decider approves: what is new, then what is gone. */
export function ChangedSentences({ changes }: ChangedSentencesProps) {
  const { t } = useTranslation();
  if (changes.count === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {t("navigation:documents.makeCurrent.formatOnly")}
      </p>
    );
  }
  const groups = [
    {
      title: t("navigation:documents.makeCurrent.added"),
      sentences: changes.added,
      tone: "border-success/40 bg-success/4",
    },
    {
      title: t("navigation:documents.makeCurrent.removed"),
      sentences: changes.removed,
      tone: "border-destructive/40 bg-destructive/4 line-through",
    },
  ];
  return (
    <div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
      {groups.map(
        (group) =>
          group.sentences.length > 0 && (
            <section key={group.title} aria-label={group.title}>
              <h3 className="mb-1 font-medium text-muted-foreground text-xs">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {group.sentences.map((sentence, index) => (
                  <li
                    // Sentences can repeat; their order here never changes.
                    // oxlint-disable-next-line react/no-array-index-key
                    key={`${index}:${sentence}`}
                    className={`rounded-md border-l-2 px-2 py-1 text-xs ${group.tone}`}
                  >
                    {sentence}
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
