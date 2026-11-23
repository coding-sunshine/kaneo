import type {
  ClosedWindow,
  ReviewPullRequest,
  ReviewsList,
} from "@/fetchers/github-reviews/github-reviews";

export type ReviewsTab = "created" | "toReview";
export type ReviewsFocus = "needsReview" | "done";
/** A list row: To review rows say whether they still need this person's review. */
export type ReviewItem = ReviewPullRequest & { focus?: ReviewsFocus };

// GitHub search has no team, project or issue priority, so Linear's groupings
// by those have nothing to read from here.
export type ReviewsGroupBy =
  | "none"
  | "status"
  | "focus"
  | "author"
  | "repository"
  | "size";
export type ReviewsSortBy =
  | "author"
  | "closestToMerge"
  | "name"
  | "date"
  | "size"
  | "status"
  | "updated";
export type SortDirection = "asc" | "desc";
export type ReviewsProperty =
  | "repository"
  | "id"
  | "author"
  | "date"
  | "statusDetails";

export type ReviewsView = {
  groupBy: ReviewsGroupBy;
  subGroupBy: ReviewsGroupBy;
  sortBy: ReviewsSortBy;
  sortDirection: SortDirection;
  closed: ClosedWindow;
  showDrafts: boolean;
  properties: ReviewsProperty[];
  /** Top-level group ids, as `${groupBy}:${key}`, shown collapsed. */
  collapsed: string[];
  /** Top-level group ids kept below the others. */
  pinned: string[];
};
export type ReviewsViews = Record<ReviewsTab, ReviewsView>;

export const REVIEWS_GROUP_BYS: Record<ReviewsTab, ReviewsGroupBy[]> = {
  created: ["none", "status", "author", "repository", "size"],
  toReview: ["none", "focus", "status", "author", "repository", "size"],
};
export const REVIEWS_SORT_BYS: ReviewsSortBy[] = [
  "author",
  "closestToMerge",
  "name",
  "date",
  "size",
  "status",
  "updated",
];
export const REVIEWS_PROPERTIES: ReviewsProperty[] = [
  "repository",
  "id",
  "author",
  "date",
  "statusDetails",
];
export const CLOSED_WINDOWS: ClosedWindow[] = [
  "none",
  "day",
  "week",
  "month",
  "all",
];

/** The direction each ordering starts in when picked, as Linear does. */
export const DEFAULT_SORT_DIRECTION: Record<ReviewsSortBy, SortDirection> = {
  author: "asc",
  closestToMerge: "asc",
  name: "asc",
  date: "desc",
  size: "desc",
  status: "asc",
  updated: "desc",
};

// Linear's defaults per tab: merged and closed PRs, and reviews already done,
// start collapsed.
export const DEFAULT_REVIEWS_VIEWS: ReviewsViews = {
  created: {
    groupBy: "status",
    subGroupBy: "none",
    sortBy: "date",
    sortDirection: "desc",
    closed: "week",
    showDrafts: true,
    properties: ["date"],
    collapsed: ["status:merged", "status:closed"],
    pinned: [],
  },
  toReview: {
    groupBy: "focus",
    subGroupBy: "none",
    sortBy: "closestToMerge",
    sortDirection: "asc",
    closed: "day",
    showDrafts: true,
    properties: ["date"],
    collapsed: ["focus:done"],
    pinned: [],
  },
};

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const strings = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? (value as string[])
    : fallback;

/** Saved views can predate a field or hold a value since dropped; keep what still fits. */
export function sanitizeReviewsViews(saved: unknown): ReviewsViews {
  const views = (saved ?? {}) as Partial<Record<ReviewsTab, unknown>>;
  const one = (tab: ReviewsTab): ReviewsView => {
    const base = DEFAULT_REVIEWS_VIEWS[tab];
    const view = (views[tab] ?? {}) as Partial<
      Record<keyof ReviewsView, unknown>
    >;
    const groups = REVIEWS_GROUP_BYS[tab];
    return {
      groupBy: pick(view.groupBy, groups, base.groupBy),
      subGroupBy: pick(view.subGroupBy, groups, base.subGroupBy),
      sortBy: pick(view.sortBy, REVIEWS_SORT_BYS, base.sortBy),
      sortDirection: pick(
        view.sortDirection,
        ["asc", "desc"],
        base.sortDirection,
      ),
      closed: pick(view.closed, CLOSED_WINDOWS, base.closed),
      showDrafts:
        typeof view.showDrafts === "boolean"
          ? view.showDrafts
          : base.showDrafts,
      properties: strings(view.properties, base.properties).filter(
        (property): property is ReviewsProperty =>
          REVIEWS_PROPERTIES.includes(property as ReviewsProperty),
      ),
      collapsed: strings(view.collapsed, base.collapsed),
      pinned: strings(view.pinned, base.pinned),
    };
  };
  return { created: one("created"), toReview: one("toReview") };
}

/**
 * The widest closed window either tab shows. The page and the sidebar badge
 * both fetch with it, so they share one cache entry.
 */
export function fetchWindow(views: ReviewsViews): ClosedWindow {
  const rank = (window: ClosedWindow) => CLOSED_WINDOWS.indexOf(window);
  return rank(views.created.closed) >= rank(views.toReview.closed)
    ? views.created.closed
    : views.toReview.closed;
}

const WINDOW_DAYS = { day: 1, week: 7, month: 30 } as const;

function closedInWindow(
  pr: ReviewPullRequest,
  window: ClosedWindow,
  now: Date,
) {
  if (pr.status === "open" || pr.status === "draft") return true;
  if (window === "all") return true;
  if (window === "none" || !pr.closedAt) return false;
  const since = now.getTime() - WINDOW_DAYS[window] * 86_400_000;
  return new Date(pr.closedAt).getTime() >= since;
}

/** The rows one tab shows, before search, grouping and ordering. */
export function tabItems(
  data: ReviewsList,
  tab: ReviewsTab,
  view: Pick<ReviewsView, "closed" | "showDrafts">,
  now = new Date(),
): ReviewItem[] {
  const items: ReviewItem[] =
    tab === "created"
      ? data.created
      : [
          ...data.toReview.map((pr) => ({
            ...pr,
            focus: "needsReview" as const,
          })),
          ...data.participated.map((pr) => ({ ...pr, focus: "done" as const })),
        ];
  return items.filter(
    (pr) =>
      (view.showDrafts || pr.status !== "draft") &&
      closedInWindow(pr, view.closed, now),
  );
}

const FIXED_ORDER: Partial<Record<ReviewsGroupBy, string[]>> = {
  status: ["draft", "open", "merged", "closed"],
  focus: ["needsReview", "done"],
  size: ["xs", "s", "m", "l", "xl"],
};

export function sizeBucket(pr: ReviewPullRequest) {
  const lines = pr.additions + pr.deletions;
  if (lines < 10) return "xs";
  if (lines < 50) return "s";
  if (lines < 250) return "m";
  if (lines < 1000) return "l";
  return "xl";
}

export function groupKey(pr: ReviewItem, by: ReviewsGroupBy) {
  switch (by) {
    case "status":
      return pr.status;
    case "focus":
      return pr.focus ?? "needsReview";
    case "author":
      return pr.author?.login ?? "";
    case "repository":
      return `${pr.owner}/${pr.repo}`;
    case "size":
      return sizeBucket(pr);
    default:
      return "all";
  }
}

/** When the PR was opened, or merged or closed once it has been. */
export const reviewDate = (pr: ReviewPullRequest) =>
  pr.closedAt ?? pr.createdAt;

// ponytail: Linear does not document "Closest to merge"; this ranks approval,
// then checks, with drafts and finished PRs last. Swap for Linear's rule if found.
function mergeDistance(pr: ReviewPullRequest) {
  if (pr.status === "merged" || pr.status === "closed") return 100;
  const decision =
    pr.reviewDecision === "approved"
      ? 0
      : pr.reviewDecision === "changes_requested"
        ? 2
        : 1;
  const checks = pr.checks === "success" ? 0 : pr.checks === "failure" ? 2 : 1;
  return (pr.status === "draft" ? 10 : 0) + decision * 3 + checks;
}

const STATUS_ORDER = FIXED_ORDER.status ?? [];

function compare(a: ReviewItem, b: ReviewItem, by: ReviewsSortBy) {
  switch (by) {
    case "author":
      return (a.author?.login ?? "").localeCompare(b.author?.login ?? "");
    case "closestToMerge":
      return mergeDistance(a) - mergeDistance(b);
    case "name":
      return a.title.localeCompare(b.title);
    case "date":
      return reviewDate(a).localeCompare(reviewDate(b));
    case "size":
      return a.additions + a.deletions - (b.additions + b.deletions);
    case "status":
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    default:
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

export function sortPullRequests(
  items: ReviewItem[],
  view: Pick<ReviewsView, "sortBy" | "sortDirection">,
) {
  const sign = view.sortDirection === "asc" ? 1 : -1;
  // Ties fall back to the most recently updated first.
  return [...items].sort(
    (a, b) =>
      sign * compare(a, b, view.sortBy) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function filterPullRequests(items: ReviewItem[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((pr) =>
    [pr.title, pr.owner, pr.repo, pr.author?.login ?? "", `#${pr.number}`]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

export type ReviewsGroup = {
  by: ReviewsGroupBy;
  key: string;
  items: ReviewItem[];
  children: ReviewsGroup[];
};

function bucket(items: ReviewItem[], by: ReviewsGroupBy): ReviewsGroup[] {
  const map = new Map<string, ReviewItem[]>();
  for (const pr of items) {
    const key = groupKey(pr, by);
    map.set(key, [...(map.get(key) ?? []), pr]);
  }
  const order = FIXED_ORDER[by];
  return [...map.entries()]
    .sort(([a], [b]) =>
      order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b),
    )
    .map(([key, group]) => ({ by, key, items: group, children: [] }));
}

export function groupId(group: Pick<ReviewsGroup, "by" | "key">) {
  return `${group.by}:${group.key}`;
}

export function buildGroups(
  items: ReviewItem[],
  view: Pick<ReviewsView, "groupBy" | "subGroupBy" | "pinned">,
): ReviewsGroup[] {
  if (view.groupBy === "none") {
    return [{ by: "none", key: "all", items, children: [] }];
  }
  const groups = bucket(items, view.groupBy).map((group) => ({
    ...group,
    children:
      view.subGroupBy !== "none" && view.subGroupBy !== view.groupBy
        ? bucket(group.items, view.subGroupBy)
        : [],
  }));
  const pinned = (group: ReviewsGroup) =>
    view.pinned.includes(groupId(group)) ? 1 : 0;
  return groups.sort((a, b) => pinned(a) - pinned(b));
}

/**
 * Rows in the order they appear on screen, for keyboard navigation. Rows in
 * collapsed groups are hidden, so they are left out.
 */
export function visibleRows(
  groups: ReviewsGroup[],
  collapsed: string[] = [],
): ReviewItem[] {
  return groups.flatMap((group) =>
    collapsed.includes(groupId(group))
      ? []
      : group.children.length > 0
        ? visibleRows(group.children)
        : group.items,
  );
}
