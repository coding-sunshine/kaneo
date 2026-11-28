import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PullRequestActionDialog,
  type PullRequestAction,
} from "@/components/reviews/pull-request-action-dialog";
import { ReviewGroupHeader } from "@/components/reviews/review-group-header";
import {
  ReviewRow,
  reviewDetailParams,
  reviewDetailRoute,
  reviewRowKey,
} from "@/components/reviews/review-row";
import {
  groupId,
  type ReviewItem,
  type ReviewsGroup,
  type ReviewsView,
  visibleRows,
} from "@/lib/reviews-view";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

export function ReviewsList({
  groups,
  view,
  workspaceId,
  selectedKey,
  onViewChange,
  me,
}: {
  groups: ReviewsGroup[];
  view: ReviewsView;
  workspaceId: string;
  selectedKey?: string;
  onViewChange: (patch: Partial<ReviewsView>) => void;
  me: string | null;
}) {
  const navigate = useNavigate();
  const order = useMemo(
    () => visibleRows(groups, view.collapsed),
    [groups, view.collapsed],
  );
  const [active, setActive] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    pr: ReviewItem;
    action: PullRequestAction;
  } | null>(null);
  const index = order.findIndex((pr) => reviewRowKey(pr) === active);

  const focusRow = (pr: ReviewItem | undefined) => {
    if (!pr) return;
    setActive(reviewRowKey(pr));
    const element = document.querySelector<HTMLElement>(
      `[data-review-row="${CSS.escape(reviewRowKey(pr))}"]`,
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
      navigate({
        to: reviewDetailRoute,
        params: reviewDetailParams(pr, workspaceId),
      });
    },
    { enabled: index !== -1 },
  );

  const rows = (items: ReviewItem[]) =>
    items.map((pr) => (
      <ReviewRow
        key={reviewRowKey(pr)}
        pr={pr}
        workspaceId={workspaceId}
        properties={view.properties}
        selected={reviewRowKey(pr) === selectedKey}
        onFocus={() => setActive(reviewRowKey(pr))}
        onAction={(row, action) => setPending({ pr: row, action })}
        me={me}
      />
    ));

  const topIds = groups.filter((g) => g.by !== "none").map(groupId);
  const allCollapsed =
    topIds.length > 0 && topIds.every((id) => view.collapsed.includes(id));
  // Expanding all frees only these groups; collapsed ids from other groupings stay.
  const toggleAll = () =>
    onViewChange({
      collapsed: allCollapsed
        ? view.collapsed.filter((id) => !topIds.includes(id))
        : [...new Set([...view.collapsed, ...topIds])],
    });

  return (
    <div className="flex flex-col gap-px py-2">
      {pending && (
        <PullRequestActionDialog
          pullRef={{
            owner: pending.pr.owner,
            repo: pending.pr.repo,
            number: String(pending.pr.number),
          }}
          pull={pending.pr}
          action={pending.action}
          onClose={() => setPending(null)}
        />
      )}
      {groups.map((group) => {
        if (group.by === "none") return rows(group.items);
        const id = groupId(group);
        const collapsed = view.collapsed.includes(id);
        return (
          <section key={id} className="flex flex-col gap-px">
            <ReviewGroupHeader
              group={group}
              level={0}
              collapsed={collapsed}
              pinned={view.pinned.includes(id)}
              allCollapsed={allCollapsed}
              onToggleAllCollapsed={toggleAll}
              onToggleCollapsed={() =>
                onViewChange({ collapsed: toggle(view.collapsed, id) })
              }
              onTogglePin={() =>
                onViewChange({ pinned: toggle(view.pinned, id) })
              }
            />
            {!collapsed &&
              (group.children.length > 0
                ? group.children.map((child) => (
                    <div key={groupId(child)} className="flex flex-col gap-px">
                      <ReviewGroupHeader group={child} level={1} />
                      {rows(child.items)}
                    </div>
                  ))
                : rows(group.items))}
          </section>
        );
      })}
    </div>
  );
}
