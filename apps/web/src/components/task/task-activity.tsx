import { useTranslation } from "react-i18next";
import Activity from "@/components/activity";
import CommentInput from "@/components/activity/comment-input";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Timeline } from "@/components/ui/timeline";
import { useToggleTaskSubscription } from "@/hooks/mutations/task/use-toggle-task-subscription";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { cn } from "@/lib/cn";

type TaskActivityProps = {
  taskId: string;
  projectId: string;
  className?: string;
};

export function TaskActivity({
  taskId,
  projectId,
  className,
}: TaskActivityProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: newestFirst = [] } = useGetActivitiesByTaskId(taskId);
  const { data: task } = useGetTask(taskId);
  const { mutate: toggleSubscription } = useToggleTaskSubscription(taskId);
  const subscribed = Boolean(
    task && "isSubscribed" in task && task.isSubscribed,
  );
  const activities = [...newestFirst].reverse();

  return (
    <section
      aria-label={t("tasks:detail.activity")}
      className={cn("flex flex-col gap-1", className)}
    >
      <div className="flex h-8 items-center justify-between pb-1">
        <h2 className="font-medium text-[15px] text-foreground">
          {t("tasks:detail.activity")}
        </h2>
        <button
          type="button"
          className="rounded-sm px-1.5 py-0.5 text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => toggleSubscription(!subscribed)}
        >
          {t(
            subscribed
              ? "tasks:subscription.unsubscribe"
              : "tasks:subscription.subscribe",
          )}
        </button>
      </div>

      {activities.length > 0 ? (
        <Timeline>
          {activities.map((activity, index) => (
            <Activity key={activity.id} activity={activity} step={index + 1} />
          ))}
        </Timeline>
      ) : (
        <p className="px-2 py-1 text-muted-foreground text-xs">
          {t("tasks:detail.noActivity")}
        </p>
      )}

      {user?.id && (
        <div className="pt-2">
          <CommentInput taskId={taskId} projectId={projectId} />
        </div>
      )}
    </section>
  );
}
