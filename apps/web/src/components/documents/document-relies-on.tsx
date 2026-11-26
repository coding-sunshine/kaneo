import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentReliedTopics } from "@/hooks/queries/topic/use-facts";
import { useTopics } from "@/hooks/queries/topic/use-topics";
import { ReliedFacts } from "./relied-facts";

type DocumentReliesOnProps = {
  workspaceId: string;
  documentId: string;
  canEdit: boolean;
};

/**
 * The facts of other topics this document rests on. When a topic replaces
 * one, the document is flagged under Documents > Needs review.
 */
export function DocumentReliesOn({
  workspaceId,
  documentId,
  canEdit,
}: DocumentReliesOnProps) {
  const { t } = useTranslation();
  const { data: relied } = useDocumentReliedTopics(workspaceId, documentId);
  const { data: topics = [] } = useTopics(workspaceId);
  const [added, setAdded] = useState<string[]>([]);
  const shownIds = [...new Set([...(relied?.topicIds ?? []), ...added])];
  const shown = topics.filter((topic) => shownIds.includes(topic.id));
  const offered = topics.filter((topic) => !shownIds.includes(topic.id));
  if (shown.length === 0 && !canEdit) return null;

  return (
    <section className="flex flex-col gap-2 border-border/60 border-t pt-3">
      <div>
        <h3 className="font-medium text-[13px]">
          {t("navigation:documents.facts.relies.title")}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t("navigation:documents.facts.reliesOn.hint")}
        </p>
      </div>
      {shown.map((topic) => (
        <div key={topic.id} className="flex flex-col gap-1">
          <Link
            to="/dashboard/workspace/$workspaceId/topic/$topicId"
            params={{ workspaceId, topicId: topic.id }}
            className="truncate font-medium text-xs underline underline-offset-2"
          >
            {topic.name}
          </Link>
          <ReliedFacts
            workspaceId={workspaceId}
            work={{ documentId }}
            topicId={topic.id}
          />
        </div>
      ))}
      {canEdit && offered.length > 0 && (
        <select
          value=""
          aria-label={t("navigation:documents.facts.reliesOn.pick")}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          onChange={(event) =>
            event.target.value &&
            setAdded((ids) => [...ids, event.target.value])
          }
        >
          <option value="">
            {t("navigation:documents.facts.reliesOn.pick")}
          </option>
          {offered.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.parentName
                ? `${topic.name} · ${topic.parentName}`
                : topic.name}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}
