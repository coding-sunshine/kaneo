import { Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sectionRowClass } from "@/components/task/sections/section-row-class";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import type { Topic } from "@/fetchers/topic/topics";
import {
  useLinkTaskTopic,
  useUnlinkTaskTopic,
} from "@/hooks/mutations/topic/use-topic-mutations";
import { useTaskTopics, useTopics } from "@/hooks/queries/topic/use-topics";
import { ReliedFacts } from "@/components/documents/relied-facts";
import { toast } from "@/lib/toast";
import { useTopicCurrentLine } from "./use-topic-current-line";

type TaskTopicsProps = { workspaceId: string; taskId: string };

function TopicRow({
  workspaceId,
  taskId,
  topic,
  onRemove,
}: {
  workspaceId: string;
  taskId: string;
  topic: Topic;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const line = useTopicCurrentLine(topic);
  return (
    <li className="flex min-w-0 flex-col">
      <div className="flex min-w-0 items-center gap-1">
        <div className={`${sectionRowClass} flex-1`}>
          <Link
            to="/dashboard/workspace/$workspaceId/topic/$topicId"
            params={{ workspaceId, topicId: topic.id }}
            className="min-w-0 truncate text-[13px] text-foreground/85 outline-none hover:text-foreground focus-visible:underline"
          >
            {topic.name}
          </Link>
          {topic.currentDocumentId && topic.currentDocumentTitle ? (
            <Link
              to="/dashboard/workspace/$workspaceId/document/$documentId"
              params={{ workspaceId, documentId: topic.currentDocumentId }}
              className="min-w-0 flex-1 truncate text-info-foreground text-xs underline underline-offset-2 outline-none focus-visible:bg-accent"
            >
              {topic.currentDocumentTitle}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
              {line}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={t("navigation:documents.taskTopic.remove", {
            name: topic.name,
          })}
          onClick={onRemove}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <ReliedFacts
        workspaceId={workspaceId}
        work={{ taskId }}
        topicId={topic.id}
      />
    </li>
  );
}

/** The topics an issue is on, with each topic's current document. */
export function TaskTopics({ workspaceId, taskId }: TaskTopicsProps) {
  const { t } = useTranslation();
  const { data: on = [] } = useTaskTopics(workspaceId, taskId);
  const { data: all = [] } = useTopics(workspaceId);
  const link = useLinkTaskTopic(workspaceId);
  const unlink = useUnlinkTaskTopic(workspaceId);
  const choices = all.filter((topic) => !on.some((row) => row.id === topic.id));
  const change = (
    mutation: typeof link,
    topic: Topic,
    failed: "addFailed" | "removeFailed",
  ) =>
    mutation.mutate(
      { workspaceId, id: topic.id, taskId },
      {
        onError: () =>
          toast.error(t(`navigation:documents.taskTopic.${failed}`)),
      },
    );
  return (
    <div className="flex flex-col">
      {on.length > 0 && (
        <ul className="flex flex-col">
          {on.map((topic) => (
            <TopicRow
              key={topic.id}
              workspaceId={workspaceId}
              taskId={taskId}
              topic={topic}
              onRemove={() => change(unlink, topic, "removeFailed")}
            />
          ))}
        </ul>
      )}
      <Menu>
        <MenuTrigger className="flex w-fit items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent">
          <Plus aria-hidden="true" className="size-3.5" />
          {t("navigation:documents.taskTopic.add")}
        </MenuTrigger>
        <MenuPopup align="start" className="min-w-44">
          {choices.length === 0 ? (
            <p className="px-2 py-1.5 text-muted-foreground text-xs">
              {t("navigation:documents.taskTopic.noMore")}
            </p>
          ) : (
            choices.map((topic) => (
              <MenuItem
                key={topic.id}
                onClick={() => change(link, topic, "addFailed")}
              >
                {topic.name}
              </MenuItem>
            ))
          )}
        </MenuPopup>
      </Menu>
    </div>
  );
}
