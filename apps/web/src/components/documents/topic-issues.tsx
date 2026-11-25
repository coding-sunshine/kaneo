import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useTopicTasks } from "@/hooks/queries/topic/use-topics";
import { cn } from "@/lib/cn";
import { TopicSection } from "./topic-section";

type TopicIssuesProps = { workspaceId: string; topicId: string };

/** The issues on a topic, each linking to its page. */
export function TopicIssues({ workspaceId, topicId }: TopicIssuesProps) {
  const { t } = useTranslation();
  const { data } = useTopicTasks(workspaceId, topicId);
  const tasks = data?.tasks ?? [];
  return (
    <TopicSection
      id="topic-issues"
      title={t("navigation:documents.taskTopic.issues")}
    >
      {tasks.length === 0 ? (
        <p className="px-4 text-muted-foreground text-sm">
          {t("navigation:documents.taskTopic.noIssues")}
        </p>
      ) : (
        <>
          {tasks.every((task) => task.closed) && (
            <p className="px-4 text-muted-foreground text-sm">
              {t("navigation:documents.taskTopic.allClosed")}
            </p>
          )}
          <ul className="flex flex-col px-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: task.projectId,
                    taskId: task.id,
                  }}
                  className={cn(
                    "flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] outline-none hover:bg-accent focus-visible:bg-accent",
                    task.closed && "text-muted-foreground",
                  )}
                >
                  <span className="shrink-0 font-medium">
                    {`${task.projectSlug.toUpperCase()}-${task.number}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  {task.closed && (
                    <span className="shrink-0 text-xs">
                      {t("navigation:documents.taskTopic.closed")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </TopicSection>
  );
}
