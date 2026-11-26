import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useTopicFacts } from "@/hooks/queries/topic/use-facts";

type FactNowProps = {
  workspaceId: string;
  /** The fact whose value was replaced, and the topic that tracks it. */
  cause: { topicId: string; slot: string; slotName: string };
};

/** What the topic states now for a fact whose value was replaced. */
export function FactNow({ workspaceId, cause }: FactNowProps) {
  const { t } = useTranslation();
  const { data: facts } = useTopicFacts(workspaceId, cause.topicId);
  if (!facts) return null;
  const now = facts.answers.find((answer) => answer.slot === cause.slot);
  if (!now?.value) {
    return (
      <p className="text-xs">
        {t("navigation:documents.facts.needsReview.holdsNothing", {
          name: cause.slotName,
        })}
      </p>
    );
  }
  return (
    <p className="text-xs">
      {t("navigation:documents.facts.needsReview.holdsNow", {
        name: cause.slotName,
        value: now.value,
      })}
      {now.documentId && (
        <>
          {" "}
          <Link
            to="/dashboard/workspace/$workspaceId/document/$documentId"
            params={{ workspaceId, documentId: now.documentId }}
            className="text-info-foreground underline underline-offset-2 outline-none focus-visible:bg-accent"
          >
            {now.documentTitle || t("navigation:documents.untitled")}
          </Link>
        </>
      )}
    </p>
  );
}
