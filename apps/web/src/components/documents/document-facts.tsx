import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentDetail } from "@/fetchers/document/documents";
import type { StatedFact } from "@/fetchers/document/facts";
import type { Topic } from "@/fetchers/topic/topics";
import { useConfirmDocumentFact } from "@/hooks/mutations/topic/use-fact-mutations";
import {
  useDocumentFacts,
  useDocumentReceipt,
} from "@/hooks/queries/topic/use-facts";
import { toast } from "@/lib/toast";
import { DocumentFactMissing } from "./document-fact-missing";
import { DocumentFactRow } from "./document-fact-row";
import { DocumentReliesOn } from "./document-relies-on";
import { factGroups } from "./fact-groups";
import { FactConflictCard } from "./fact-conflict-card";
import { RejectFactDialog } from "./reject-fact-dialog";

type DocumentFactsProps = {
  document: Pick<DocumentDetail, "workspaceId" | "id" | "status" | "topicId">;
  /** Null or undefined when the viewer cannot open the topic. */
  topic: Pick<Topic, "id" | "canDecide" | "deciderName"> | null | undefined;
  canEdit: boolean;
  onClose: () => void;
};

/** What this document says about the facts its topic tracks. */
export function DocumentFacts({
  document,
  topic,
  canEdit,
  onClose,
}: DocumentFactsProps) {
  const { t } = useTranslation();
  const { workspaceId, id } = document;
  const askId = document.topicId && topic ? id : null;
  const receipt = useDocumentReceipt(workspaceId, askId);
  const facts = useDocumentFacts(workspaceId, askId);
  const confirm = useConfirmDocumentFact(workspaceId);
  const [rejecting, setRejecting] = useState<StatedFact | null>(null);

  const isCurrent = document.status === "current";
  const isProposal = document.status === "in_review";
  const decider = topic?.canDecide ?? false;
  const canConfirm = canEdit && (decider || (!isCurrent && !isProposal));
  const groups = receipt.data ? factGroups(receipt.data, isCurrent) : [];
  const all = facts.data ?? [];
  const rejectedFor = (slot: string) =>
    all
      .filter((fact) => fact.slot === slot && fact.status === "rejected")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const confirmFact = (statementId: string) =>
    confirm.mutate(
      { workspaceId, id, statementId },
      {
        onSuccess: () =>
          toast.success(t("navigation:documents.facts.confirmDone")),
        onError: (error) => toast.error(error.message),
      },
    );

  let body: React.ReactNode;
  if (!document.topicId || !topic) {
    body = (
      <p className="text-muted-foreground text-xs">
        {t("navigation:documents.facts.noTopic")}
      </p>
    );
  } else if (receipt.isPending) {
    body = <Skeleton className="h-24 w-full" />;
  } else if (receipt.error) {
    body = (
      <p className="text-muted-foreground text-xs">{receipt.error.message}</p>
    );
  } else if (groups.length === 0) {
    body = (
      <>
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.noFacts")}
        </p>
        <Link
          to="/dashboard/workspace/$workspaceId/topic/$topicId"
          params={{ workspaceId, topicId: topic.id }}
          className="font-medium text-[13px] underline underline-offset-2"
        >
          {t("navigation:documents.facts.openTopic")}
        </Link>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-muted-foreground text-xs">
          {t(
            isCurrent
              ? "navigation:documents.facts.intro.current"
              : "navigation:documents.facts.intro.proposal",
          )}
        </p>
        {canEdit && (isCurrent || isProposal) && !decider && (
          <p className="text-muted-foreground text-xs">
            {t(
              isCurrent
                ? "navigation:documents.facts.deciderOnly"
                : "navigation:documents.facts.deciderOnlyProposal",
            )}
          </p>
        )}
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <div>
              <h3 className="font-medium text-[13px]">
                {t(`navigation:documents.facts.groups.${group.key}`)}{" "}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {group.rows.length}
                </span>
              </h3>
              <p className="text-muted-foreground text-xs">
                {t(`navigation:documents.facts.groupHints.${group.key}`)}
              </p>
            </div>
            {(group.key === "conflicts" || group.key === "decided") &&
              group.rows.map((conflict) => (
                <FactConflictCard
                  key={conflict.statementId}
                  workspaceId={workspaceId}
                  documentId={id}
                  conflict={conflict}
                  canDecide={decider}
                  deciderName={topic.deciderName}
                />
              ))}
            {group.key === "notChecked" &&
              group.rows.map((fact) => (
                <DocumentFactMissing
                  key={fact.slot}
                  document={document}
                  fact={fact}
                  rejected={rejectedFor(fact.slot)}
                  canEdit={canEdit && (!isCurrent || decider)}
                />
              ))}
            {group.key !== "conflicts" &&
              group.key !== "decided" &&
              group.key !== "notChecked" &&
              group.rows.map((fact) => (
                <DocumentFactRow
                  key={fact.statementId}
                  fact={fact}
                  detail={all.find((item) => item.id === fact.statementId)}
                  showCurrent={group.key === "unjudged"}
                  canConfirm={canConfirm}
                  pending={confirm.isPending}
                  onConfirm={() => confirmFact(fact.statementId)}
                  onReject={() => setRejecting(fact)}
                />
              ))}
          </section>
        ))}
      </>
    );
  }

  return (
    <aside
      aria-label={t("navigation:documents.facts.title")}
      className="flex w-full max-w-[380px] shrink-0 flex-col border-border/60 border-l"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 px-4">
        <h2 className="font-medium text-[13px]">
          {t("navigation:documents.facts.title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("navigation:documents.facts.close")}
          onClick={onClose}
          className="ms-auto"
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {body}
        <DocumentReliesOn
          workspaceId={workspaceId}
          documentId={id}
          canEdit={canEdit}
        />
      </div>
      {rejecting && (
        <RejectFactDialog
          workspaceId={workspaceId}
          documentId={id}
          fact={rejecting}
          onClose={() => setRejecting(null)}
        />
      )}
    </aside>
  );
}
