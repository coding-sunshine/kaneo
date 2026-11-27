import { useQueries } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  type DocumentSummary,
  getDocument,
} from "@/fetchers/document/documents";
import { documentKey } from "@/hooks/queries/document/use-documents";
import { toast } from "@/lib/toast";
import { PinnedDocumentCard } from "./pinned-document-card";
import { useDocumentPins } from "./use-document-pins";

type PinnedDocumentsProps = {
  workspaceId: string;
  /** The listed documents, newest first: "Pin most recent" takes the first. */
  documents: DocumentSummary[];
  onChoose: () => void;
};

/** Linear's pinned area on the Documents page: cards, or how to pin some. */
export function PinnedDocuments({
  workspaceId,
  documents,
  onChoose,
}: PinnedDocumentsProps) {
  const { t } = useTranslation();
  const pins = useDocumentPins(workspaceId);
  // Pins are few, and a pinned document need not be on this tab's list.
  const pinned = useQueries({
    queries: pins.pinnedIds.map((id) => ({
      queryKey: documentKey(workspaceId, id),
      queryFn: () => getDocument(workspaceId, id),
      retry: false,
    })),
  });
  const cards = pinned.flatMap((query) => (query.data ? [query.data] : []));
  const failed = (error: Error) => toast.error(error.message);

  if (pins.isLoading) return null;
  if (pins.pinnedIds.length) {
    return (
      <section
        aria-label={t("navigation:documents.pins.title")}
        className="mx-4 mt-3 flex shrink-0 gap-3 overflow-x-auto rounded-lg bg-muted/40 p-4"
      >
        {cards.map((document) => (
          <PinnedDocumentCard
            key={document.id}
            document={document}
            onUnpin={() => pins.unpin(document.id).catch(failed)}
          />
        ))}
      </section>
    );
  }
  const newest = documents[0];
  return (
    <section
      aria-label={t("navigation:documents.pins.title")}
      className="mx-4 mt-3 flex h-48 shrink-0 flex-col items-center justify-center rounded-lg border border-border/70 border-dashed bg-muted/30 px-4 text-center"
    >
      <Pin aria-hidden className="size-4 text-muted-foreground" />
      <h2 className="mt-3 font-medium text-[13px]">
        {t("navigation:documents.pins.emptyTitle")}
      </h2>
      <p className="mt-1 text-muted-foreground text-xs">
        {t("navigation:documents.pins.emptyHint")}
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="xs"
          className="rounded-full"
          disabled={!newest || pins.isPending}
          onClick={() => newest && pins.pin([newest.id]).catch(failed)}
        >
          {t("navigation:documents.pins.pinMostRecent")}
        </Button>
        <Button
          variant="outline"
          size="xs"
          className="rounded-full"
          onClick={onChoose}
        >
          {t("navigation:documents.pins.choose")}
        </Button>
      </div>
    </section>
  );
}
