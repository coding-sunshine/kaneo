import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TopicFact } from "@/fetchers/topic/facts";
import { formatDateMedium } from "@/lib/format";

type TopicFactRowProps = {
  workspaceId: string;
  fact: TopicFact;
  reliedOn: number;
  /** Null hides the button: the fact cannot be untracked yet. */
  onUntrack: (() => void) | null;
};

const linkClass = "text-info-foreground underline underline-offset-2";

/** One fact the topic tracks, with what it states now and where that came from. */
export function TopicFactRow({
  workspaceId,
  fact,
  reliedOn,
  onUntrack,
}: TopicFactRowProps) {
  const { t } = useTranslation();
  const documentLink = (id: string, title: string | null) => (
    <Link
      to="/dashboard/workspace/$workspaceId/document/$documentId"
      params={{ workspaceId, documentId: id }}
      className={linkClass}
    >
      {title || t("navigation:documents.untitled")}
    </Link>
  );
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 rounded-md px-2 py-2 sm:grid-cols-[10rem_1fr_auto]">
      <div className="min-w-0">
        <p className="break-words font-medium text-[13px]">{fact.slotName}</p>
        <p className="text-muted-foreground text-xs">
          {t(`navigation:documents.facts.topic.types.${fact.type}`)}
        </p>
      </div>
      {/* On a phone the value goes under the name and the remove button stays beside the name. */}
      <div className="min-w-0 break-words text-[13px] max-sm:col-start-1 max-sm:row-start-2">
        {fact.value ? (
          <p>{fact.value}</p>
        ) : (
          <p className="text-muted-foreground">
            {t("navigation:documents.facts.topic.noValue")}
          </p>
        )}
        <div className="flex flex-col gap-0.5 text-muted-foreground text-xs">
          {fact.quote && fact.documentId && (
            <p>
              <q>{fact.quote}</q>{" "}
              {documentLink(fact.documentId, fact.documentTitle)}
            </p>
          )}
          {fact.approvedByName && fact.approvedAt && (
            <p>
              {t("navigation:documents.facts.topic.approved", {
                name: fact.approvedByName,
                date: formatDateMedium(fact.approvedAt),
              })}
            </p>
          )}
          {fact.proposedIn.length > 0 && (
            <p>
              {t("navigation:documents.facts.topic.alsoIn", {
                count: fact.proposedIn.length,
              })}{" "}
              {fact.proposedIn.map((proposal, index) => (
                <span key={proposal.id}>
                  {index > 0 && ", "}
                  {documentLink(proposal.id, proposal.title)}
                </span>
              ))}
            </p>
          )}
          {reliedOn > 0 && (
            <p>
              {t("navigation:documents.facts.topic.reliedOn", {
                count: reliedOn,
              })}
            </p>
          )}
        </div>
      </div>
      {onUntrack && (
        <button
          type="button"
          aria-label={t("navigation:documents.facts.topic.untrack", {
            name: fact.slotName,
          })}
          onClick={onUntrack}
          className="touch-hitbox relative flex size-6 shrink-0 items-center max-sm:col-start-2 max-sm:row-start-1 justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </li>
  );
}
