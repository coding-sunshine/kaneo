import { Link, useNavigate } from "@tanstack/react-router";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PullRequestStatusIcon } from "@/components/task/task-pull-requests/pull-request-status-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ReviewPullRequest } from "@/fetchers/github-reviews/github-reviews";
import { formatRelativeTime } from "@/lib/format";
import {
  buildGroups,
  flattenGroups,
  pinId,
  type ReviewsGroup,
  type ReviewsView,
} from "@/lib/reviews-view";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

const rowKey = (pr: ReviewPullRequest) => `${pr.owner}/${pr.repo}#${pr.number}`;

const detailRoute =
  "/dashboard/workspace/$workspaceId/reviews/$owner/$repo/$number" as const;

const detailParams = (pr: ReviewPullRequest, workspaceId: string) => ({
  workspaceId,
  owner: pr.owner,
  repo: pr.repo,
  number: String(pr.number),
});

function ChecksIcon({ state }: { state: ReviewPullRequest["checks"] }) {
  const { t } = useTranslation();
  if (state === "none") return null;
  const Icon =
    state === "success"
      ? CircleCheck
      : state === "failure"
        ? CircleX
        : LoaderCircle;
  const color =
    state === "success"
      ? "text-success-foreground"
      : state === "failure"
        ? "text-destructive-foreground"
        : "text-muted-foreground";
  return (
    <Icon
      aria-label={t(`workspace:reviews.checks.${state}`)}
      className={`size-3.5 shrink-0 ${color}`}
    />
  );
}

function ReviewRow({
  pr,
  workspaceId,
  view,
  onFocus,
}: {
  pr: ReviewPullRequest;
  workspaceId: string;
  view: ReviewsView;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Link
      to={detailRoute}
      params={detailParams(pr, workspaceId)}
      data-review-row={rowKey(pr)}
      onFocus={onFocus}
      className="flex h-10 items-center gap-2.5 border-border/50 border-b px-1 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <PullRequestStatusIcon status={pr.status} className="size-3.5" />
      {view.showRepository && (
        <span className="hidden w-48 shrink-0 truncate text-muted-foreground text-xs sm:block">
          {pr.owner}/{pr.repo} #{pr.number}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {pr.title}
      </span>
      {pr.reviewDecision && (
        <span className="hidden shrink-0 text-muted-foreground text-xs md:block">
          {t(`workspace:reviews.reviewStatus.${pr.reviewDecision}`)}
        </span>
      )}
      {view.showSize && (
        <span className="hidden shrink-0 font-mono text-xs tabular-nums md:block">
          <span className="text-success-foreground">+{pr.additions}</span>{" "}
          <span className="text-destructive-foreground">−{pr.deletions}</span>
        </span>
      )}
      {view.showChecks && <ChecksIcon state={pr.checks} />}
      {pr.author && (
        <Avatar className="size-5" title={pr.author.login}>
          <AvatarImage src={pr.author.avatarUrl} alt={pr.author.login} />
          <AvatarFallback>{pr.author.login.slice(0, 2)}</AvatarFallback>
        </Avatar>
      )}
      <span className="hidden w-24 shrink-0 text-right text-muted-foreground text-xs sm:block">
        {formatRelativeTime(pr.updatedAt, undefined, undefined, "short")}
      </span>
    </Link>
  );
}

function GroupHeader({
  group,
  level,
  pinned,
  onTogglePin,
}: {
  group: ReviewsGroup;
  level: 0 | 1;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { t } = useTranslation();
  const label =
    group.by === "author" || group.by === "repository"
      ? group.key || t("workspace:reviews.noAuthor")
      : t(`workspace:reviews.${group.by}.${group.key}`);
  const header = (
    <h2
      className={`flex h-9 items-center gap-2 border-border/50 border-b px-5 text-[13px] ${
        level === 0 ? "bg-muted/40" : "bg-muted/20 pl-8"
      }`}
    >
      {group.by === "status" && (
        <PullRequestStatusIcon
          status={group.key as ReviewPullRequest["status"]}
          className="size-3.5"
        />
      )}
      <span className="font-semibold text-foreground">{label}</span>
      <span className="font-normal text-muted-foreground text-xs tabular-nums">
        {group.items.length}
      </span>
    </h2>
  );
  if (level === 1) return header;
  return (
    <ContextMenu>
      <ContextMenuTrigger render={header} />
      <ContextMenuContent>
        <ContextMenuItem onClick={onTogglePin}>
          {pinned
            ? t("workspace:reviews.unpinGroup")
            : t("workspace:reviews.pinGroup")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function ReviewsList({
  pullRequests,
  workspaceId,
  view,
  onViewChange,
}: {
  pullRequests: ReviewPullRequest[];
  workspaceId: string;
  view: ReviewsView;
  onViewChange: (patch: Partial<ReviewsView>) => void;
}) {
  const navigate = useNavigate();
  const groups = useMemo(
    () => buildGroups(pullRequests, view),
    [pullRequests, view],
  );
  const order = useMemo(() => flattenGroups(groups), [groups]);
  const [active, setActive] = useState<string | null>(null);
  const index = order.findIndex((pr) => rowKey(pr) === active);

  const focusRow = (pr: ReviewPullRequest | undefined) => {
    if (!pr) return;
    setActive(rowKey(pr));
    const element = document.querySelector<HTMLElement>(
      `[data-review-row="${CSS.escape(rowKey(pr))}"]`,
    );
    element?.focus({ preventScroll: true });
    element?.scrollIntoView?.({ block: "nearest" });
  };

  useShortcut("nextTask", () =>
    focusRow(order[index === -1 ? 0 : Math.min(index + 1, order.length - 1)]),
  );
  useShortcut("previousTask", () =>
    focusRow(order[index === -1 ? 0 : Math.max(index - 1, 0)]),
  );
  useShortcut(
    "openFocusedTask",
    (event) => {
      const pr = order[index];
      if (!pr) return;
      event.preventDefault();
      navigate({ to: detailRoute, params: detailParams(pr, workspaceId) });
    },
    { enabled: index !== -1 },
  );

  const togglePin = (group: ReviewsGroup) => {
    const id = pinId(group);
    onViewChange({
      pinned: view.pinned.includes(id)
        ? view.pinned.filter((entry) => entry !== id)
        : [...view.pinned, id],
    });
  };

  const rows = (items: ReviewPullRequest[]) => (
    <div className="flex flex-col px-4">
      {items.map((pr) => (
        <ReviewRow
          key={rowKey(pr)}
          pr={pr}
          workspaceId={workspaceId}
          view={view}
          onFocus={() => setActive(rowKey(pr))}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      {groups.map((group) =>
        group.by === "none" ? (
          <div key="all">{rows(group.items)}</div>
        ) : (
          <section key={pinId(group)}>
            <GroupHeader
              group={group}
              level={0}
              pinned={view.pinned.includes(pinId(group))}
              onTogglePin={() => togglePin(group)}
            />
            {group.children.length > 0
              ? group.children.map((child) => (
                  <div key={pinId(child)}>
                    <GroupHeader
                      group={child}
                      level={1}
                      pinned={false}
                      onTogglePin={() => {}}
                    />
                    {rows(child.items)}
                  </div>
                ))
              : rows(group.items)}
          </section>
        ),
      )}
    </div>
  );
}
