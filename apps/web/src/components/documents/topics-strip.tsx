import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useTopics } from "@/hooks/queries/topic/use-topics";
import { DocumentAccessLabel } from "./document-access-label";
import { NewTopicDialog } from "./new-topic-dialog";

type TopicsStripProps = { workspaceId: string };

/** The topics this person can open, above the documents list. */
export function TopicsStrip({ workspaceId }: TopicsStripProps) {
  const { t } = useTranslation();
  const { data: topics = [] } = useTopics(workspaceId);
  const [creating, setCreating] = useState(false);
  return (
    <nav
      aria-label={t("navigation:documents.topics.title")}
      className="flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-border/60 border-b px-4"
    >
      <span className="shrink-0 text-muted-foreground text-xs">
        {t("navigation:documents.topics.title")}
      </span>
      {topics.map((topic) => (
        <Link
          key={topic.id}
          to="/dashboard/workspace/$workspaceId/topic/$topicId"
          params={{ workspaceId, topicId: topic.id }}
          className="touch-hitbox relative flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-0.5 text-xs hover:bg-accent"
        >
          {topic.name}
          <DocumentAccessLabel
            scope={topic.scope}
            parentName={topic.parentName}
            className="max-w-24"
          />
        </Link>
      ))}
      <Button
        size="xs"
        variant="ghost"
        className="shrink-0 text-muted-foreground"
        onClick={() => setCreating(true)}
      >
        <Plus aria-hidden />
        {t("navigation:documents.topics.new")}
      </Button>
      {creating && (
        <NewTopicDialog
          workspaceId={workspaceId}
          onClose={() => setCreating(false)}
        />
      )}
    </nav>
  );
}
