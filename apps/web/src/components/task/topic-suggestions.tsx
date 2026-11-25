import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Topic } from "@/fetchers/topic/topics";
import { useMatchingTopics } from "@/hooks/queries/topic/use-topics";
import { useTopicCurrentLine } from "./use-topic-current-line";

type TopicSuggestionsProps = {
  workspaceId: string;
  title: string;
  picked: Topic | null;
  onPick: (topic: Topic) => void;
};

function Suggestion({
  topic,
  onPick,
}: {
  topic: Topic;
  onPick: (topic: Topic) => void;
}) {
  const line = useTopicCurrentLine(topic);
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(topic)}
        className="flex w-full flex-col rounded-md px-2 py-1 text-left outline-none hover:bg-accent focus-visible:bg-accent"
      >
        <span className="text-[13px]">{topic.name}</span>
        <span className="text-muted-foreground text-xs">{line}</span>
      </button>
    </li>
  );
}

/** Up to three topics the typed title names, under the title field. */
export function TopicSuggestions({
  workspaceId,
  title,
  picked,
  onPick,
}: TopicSuggestionsProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setText(title.trim()), 300);
    return () => clearTimeout(timer);
  }, [title]);
  const { data } = useMatchingTopics(workspaceId, text);
  const topics = (text.length >= 3 && data ? data : []).slice(0, 3);
  if (picked || topics.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs">
        {t("navigation:documents.taskTopic.matches")}
      </p>
      <ul className="flex flex-col">
        {topics.map((topic) => (
          <Suggestion key={topic.id} topic={topic} onPick={onPick} />
        ))}
      </ul>
    </div>
  );
}
