import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { useSnoozeDocument } from "@/hooks/mutations/document/use-document-mutations";
import { formatDateMedium, formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { DocumentList } from "./document-list";
import { SnoozeButton } from "./snooze-button";

type InboxListProps = { workspaceId: string; documents: DocumentSummary[] };

/**
 * Shared documents no topic holds yet. Those that wait come first, under the
 * age of the oldest; the ones set aside follow with the way back.
 */
export function InboxList({ workspaceId, documents }: InboxListProps) {
  const { t } = useTranslation();
  const snooze = useSnoozeDocument(workspaceId);
  const set = (id: string, until: string | null) =>
    snooze.mutate(
      { id, until },
      { onError: (error) => toast.error(error.message) },
    );
  const waiting = documents.filter((document) => !document.snoozedUntil);
  const snoozed = documents.filter((document) => document.snoozedUntil);
  // ponytail: age since the document was written. Nothing stores when it
  // entered a shared place; add that column if the two drift apart in use.
  const oldest = waiting
    .map((document) => String(document.createdAt))
    .sort()[0];

  return (
    <>
      <p className="border-border/60 border-b px-4 py-2 text-[13px] text-muted-foreground">
        {oldest
          ? t("navigation:documents.inbox.oldest", {
              time: formatRelativeTime(oldest),
            })
          : t("navigation:documents.inbox.nothingWaiting")}
      </p>
      <DocumentList
        workspaceId={workspaceId}
        documents={waiting}
        action={(document) => (
          <SnoozeButton
            disabled={snooze.isPending}
            onSnooze={(until) => set(document.id, until)}
          />
        )}
      />
      {snoozed.length > 0 && (
        <section aria-labelledby="inbox-snoozed">
          <h2
            id="inbox-snoozed"
            className="px-4 pt-5 pb-2 font-medium text-[13px] text-muted-foreground"
          >
            {t("navigation:documents.inbox.snoozed")}
          </h2>
          <DocumentList
            workspaceId={workspaceId}
            documents={snoozed}
            action={(document) => (
              <>
                <span className="hidden text-muted-foreground sm:block">
                  {t("navigation:documents.inbox.snoozedUntil", {
                    date: formatDateMedium(String(document.snoozedUntil)),
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={snooze.isPending}
                  onClick={() => set(document.id, null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t("navigation:documents.inbox.unsnooze")}
                </Button>
              </>
            )}
          />
        </section>
      )}
    </>
  );
}
