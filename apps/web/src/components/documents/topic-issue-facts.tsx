import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useTopicTaskStatements } from "@/hooks/queries/topic/use-topics";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { TopicIssueFactRow } from "./topic-issue-fact-row";
import { TopicSection } from "./topic-section";

type TopicIssueFactsProps = { workspaceId: string; topicId: string };

/** Facts the server found in the topic's issues; nothing at all when there are none. */
export function TopicIssueFacts({
  workspaceId,
  topicId,
}: TopicIssueFactsProps) {
  const { t } = useTranslation();
  const { data } = useTopicTaskStatements(workspaceId, topicId);
  const { canUpdateTasks } = useWorkspacePermission();
  const [showDismissed, setShowDismissed] = useState(false);
  const statements = data?.statements ?? [];
  if (!statements.length) return null;
  const canEdit = canUpdateTasks();
  const open = statements.filter((fact) => !fact.dismissed);
  const dismissed = statements.filter((fact) => fact.dismissed);
  const row = (fact: (typeof statements)[number]) => (
    <TopicIssueFactRow
      key={fact.id}
      workspaceId={workspaceId}
      topicId={topicId}
      fact={fact}
      canEdit={canEdit}
    />
  );
  return (
    <TopicSection
      id="topic-issue-facts"
      title={t("navigation:documents.issueFacts.title")}
    >
      <p className="px-4 text-muted-foreground text-xs">
        {t("navigation:documents.issueFacts.hint")}
      </p>
      {open.length > 0 && (
        <ul className="flex flex-col px-2">{open.map(row)}</ul>
      )}
      {dismissed.length > 0 && (
        <>
          <Button
            size="xs"
            variant="ghost"
            className="ml-2 self-start"
            aria-expanded={showDismissed}
            onClick={() => setShowDismissed(!showDismissed)}
          >
            {showDismissed
              ? t("navigation:documents.issueFacts.hideDismissed")
              : t("navigation:documents.issueFacts.showDismissed", {
                  count: dismissed.length,
                })}
          </Button>
          {showDismissed && (
            <ul className="flex flex-col px-2 text-muted-foreground">
              {dismissed.map(row)}
            </ul>
          )}
        </>
      )}
    </TopicSection>
  );
}
