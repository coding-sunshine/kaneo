import { Link } from "@tanstack/react-router";
import { CornerDownRight } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";

export type CreatedIssue = {
  id: string;
  projectId: string;
  projectSlug: string;
  number: number | null;
  title: string;
  status: string;
  statusIcon: string | null;
  isCompleted: boolean;
  isSubIssue: boolean;
  creatorId: string | null;
  creatorName: string | null;
};

function IssueLink({ issue }: { issue: CreatedIssue }) {
  const { data: workspace } = useActiveWorkspace();
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{
        workspaceId: workspace?.id ?? "",
        projectId: issue.projectId,
        taskId: issue.id,
      }}
      className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
        {getColumnIcon(issue.status, issue.isCompleted, issue.statusIcon)}
      </span>
      <span className="shrink-0 text-muted-foreground text-xs">
        {issue.number == null
          ? issue.projectSlug
          : `${issue.projectSlug}-${issue.number}`}
      </span>
      <span className="min-w-0 truncate text-foreground">{issue.title}</span>
    </Link>
  );
}

// Linear lists the issues made from a comment under its body, one line per
// creator, and one row per issue once someone made several.
export default function CommentCreatedIssues({
  issues,
  className,
}: {
  issues: CreatedIssue[];
  className?: string;
}) {
  const { t } = useTranslation();
  const byCreator = new Map<string, CreatedIssue[]>();
  for (const issue of issues) {
    const key = issue.creatorId ?? "";
    byCreator.set(key, [...(byCreator.get(key) ?? []), issue]);
  }

  return (
    <div className={cn("flex flex-col gap-1 text-[13px]", className)}>
      {[...byCreator.values()].map((group) => {
        const [first] = group;
        const sub = group.every((issue) => issue.isSubIssue);
        const sentence = (
          <span className="shrink-0 text-muted-foreground">
            <Trans
              i18nKey={
                group.length === 1
                  ? sub
                    ? "activity:comment.createdSubIssue"
                    : "activity:comment.createdIssue"
                  : sub
                    ? "activity:comment.createdSubIssues"
                    : "activity:comment.createdIssues"
              }
              values={{
                name: first.creatorName ?? t("common:people.someone"),
                count: group.length,
              }}
              components={{
                name: <span className="font-medium text-foreground" />,
              }}
            />
          </span>
        );
        return (
          <div key={first.creatorId ?? first.id} className="flex flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <CornerDownRight
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              {sentence}
              {group.length === 1 && <IssueLink issue={first} />}
            </div>
            {group.length > 1 && (
              <ul className="flex flex-col pl-4">
                {group.map((issue) => (
                  <li key={issue.id} className="min-w-0">
                    <IssueLink issue={issue} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
