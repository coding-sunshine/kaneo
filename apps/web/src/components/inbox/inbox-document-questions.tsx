import { useTranslation } from "react-i18next";
import { FactConflictCard } from "@/components/documents/fact-conflict-card";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { useDocumentReceipt } from "@/hooks/queries/topic/use-facts";
import { useTopic } from "@/hooks/queries/topic/use-topics";

type InboxDocumentQuestionsProps = {
  document: Pick<DocumentDetail, "workspaceId" | "id" | "topicId">;
};

// Where this document and its topic's current document disagree, so the
// decider answers without a trip to the document.
export function InboxDocumentQuestions({
  document,
}: InboxDocumentQuestionsProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const topicId = document.topicId ?? null;
  const { data: topic } = useTopic(workspaceId, topicId);
  const { data: receipt } = useDocumentReceipt(workspaceId, topicId && id);
  const open = receipt?.conflicts.filter((c) => c.status === "open") ?? [];

  if (open.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 border-border/60 border-t pt-5">
      <h3 className="font-medium text-muted-foreground text-xs">
        {t("navigation:documents.facts.conflict.open")}
      </h3>
      {open.map((conflict) => (
        <FactConflictCard
          key={conflict.id}
          workspaceId={workspaceId}
          documentId={id}
          conflict={conflict}
          canDecide={Boolean(topic?.canDecide)}
          deciderName={topic?.deciderName ?? null}
        />
      ))}
    </section>
  );
}
