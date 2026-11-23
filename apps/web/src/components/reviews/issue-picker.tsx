import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import type {
  PullRef,
  PullRequestDetail,
} from "@/fetchers/github-reviews/github-reviews";
import { useLinkPullRequestIssue } from "@/hooks/queries/github-reviews/use-github-reviews";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { toast } from "@/lib/toast";

/** Search box plus task list; picking one links it to the pull request (the Overview "Resolves" flow). */
export function IssuePicker({
  pullRef,
  pull,
  workspaceId,
  onDone,
}: {
  pullRef: PullRef;
  pull: Pick<PullRequestDetail, "url" | "status">;
  workspaceId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const link = useLinkPullRequestIssue(pullRef);
  const search = useGlobalSearch({
    q: query.trim(),
    type: "tasks",
    workspaceId,
    limit: 8,
  });
  const tasks = (search.data?.results ?? []).filter(
    (result) => result.type === "task" && !result.archivedAt,
  );
  const onError = (error: Error) => toast.error(error.message);

  return (
    <>
      <Input
        size="sm"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("workspace:reviews.detail.searchIssues")}
        aria-label={t("workspace:reviews.detail.searchIssues")}
      />
      <ul className="mt-1 flex flex-col">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-60"
              disabled={link.isPending}
              onClick={() =>
                link.mutate(
                  { taskId: task.id, url: pull.url, status: pull.status },
                  { onSuccess: onDone, onError },
                )
              }
            >
              <span className="truncate">{task.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {query.trim() !== "" && !search.isFetching && tasks.length === 0 && (
        <p className="px-2 py-1.5 text-muted-foreground text-sm">
          {t("workspace:reviews.detail.noIssuesFound")}
        </p>
      )}
    </>
  );
}
