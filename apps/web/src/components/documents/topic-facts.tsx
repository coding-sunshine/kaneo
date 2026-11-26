import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTopicDependents,
  useTopicFacts,
  useTrackedFacts,
} from "@/hooks/queries/topic/use-facts";
import { TopicFactRow } from "./topic-fact-row";
import { TopicSection } from "./topic-section";
import { TrackFactDialog } from "./track-fact-dialog";
import { UntrackFactDialog } from "./untrack-fact-dialog";

type TopicFactsProps = {
  workspaceId: string;
  topicId: string;
  canManage: boolean;
};

/** What the topic states now, fact by fact, and for its decider the facts it tracks. */
export function TopicFacts({
  workspaceId,
  topicId,
  canManage,
}: TopicFactsProps) {
  const { t } = useTranslation();
  const facts = useTopicFacts(workspaceId, topicId);
  const tracked = useTrackedFacts(workspaceId, topicId);
  const dependents = useTopicDependents(workspaceId, topicId);
  const [tracking, setTracking] = useState(false);
  const [untracking, setUntracking] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const answers = facts.data?.answers ?? [];
  const trackButton = canManage && (
    <Button
      size="xs"
      variant="outline"
      className="w-fit"
      onClick={() => setTracking(true)}
    >
      {t("navigation:documents.facts.topic.track")}
    </Button>
  );

  return (
    <TopicSection
      id="topic-facts"
      title={t("navigation:documents.facts.topic.title")}
    >
      <div className="flex flex-col gap-2 px-4">
        {facts.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : facts.isError ? (
          <p className="text-muted-foreground text-sm">{facts.error.message}</p>
        ) : answers.length === 0 ? (
          <>
            <p className="text-muted-foreground text-sm">
              {t(
                canManage
                  ? "navigation:documents.facts.topic.empty"
                  : "navigation:documents.facts.topic.emptyReadOnly",
              )}
            </p>
            {trackButton}
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {t("navigation:documents.facts.topic.hint")}
            </p>
            <ul className="-mx-2 flex flex-col">
              {answers.map((fact) => {
                const row = tracked.data?.find(
                  (item) => item.key === fact.slot,
                );
                return (
                  <TopicFactRow
                    key={fact.slot}
                    workspaceId={workspaceId}
                    fact={fact}
                    reliedOn={
                      dependents.data?.filter((item) => item.slot === fact.slot)
                        .length ?? 0
                    }
                    onUntrack={
                      canManage && row
                        ? () =>
                            setUntracking({ id: row.id, name: fact.slotName })
                        : null
                    }
                  />
                );
              })}
            </ul>
            {trackButton}
          </>
        )}
      </div>
      {tracking && (
        <TrackFactDialog
          workspaceId={workspaceId}
          topicId={topicId}
          onClose={() => setTracking(false)}
        />
      )}
      {untracking && (
        <UntrackFactDialog
          workspaceId={workspaceId}
          topicId={topicId}
          fact={untracking}
          onClose={() => setUntracking(null)}
        />
      )}
    </TopicSection>
  );
}
