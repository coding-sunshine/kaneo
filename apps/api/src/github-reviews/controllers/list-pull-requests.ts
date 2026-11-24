import { type GithubSearchPull, searchPullRequests } from "../github-api";
import type { closedWindows } from "../schema";
import { findLinkedIssues } from "../linked-issues";
import { findReviewOwners } from "../review-owners";
import { toMergeState, toReviewFields } from "../review-fields";
import { withGithubToken } from "../with-github-token";

type ClosedWindow = (typeof closedWindows)[number];

const WINDOW_DAYS = { day: 1, week: 7, month: 30 } as const;

/** First day (YYYY-MM-DD) a merged or closed PR counts, "" for all, null for none. */
export function closedSince(window: ClosedWindow, now = new Date()) {
  if (window === "none") return null;
  if (window === "all") return "";
  const since = new Date(now.getTime() - WINDOW_DAYS[window] * 86_400_000);
  return since.toISOString().slice(0, 10);
}

const decisions = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REVIEW_REQUIRED: "review_required",
} as const;

function toChecks(state: string | undefined) {
  if (state === "SUCCESS") return "success" as const;
  if (state === "FAILURE" || state === "ERROR") return "failure" as const;
  if (state === "PENDING" || state === "EXPECTED") return "pending" as const;
  return "none" as const;
}

function toSummary(pull: GithubSearchPull) {
  return {
    owner: pull.repository.owner.login,
    repo: pull.repository.name,
    number: pull.number,
    title: pull.title,
    url: pull.url,
    author: pull.author && {
      login: pull.author.login,
      avatarUrl: pull.author.avatarUrl,
    },
    authorGithubId: pull.author?.databaseId ?? null,
    status:
      pull.state === "MERGED"
        ? ("merged" as const)
        : pull.state === "CLOSED"
          ? ("closed" as const)
          : pull.isDraft
            ? ("draft" as const)
            : ("open" as const),
    comments: pull.comments.totalCount,
    createdAt: pull.createdAt,
    updatedAt: pull.updatedAt,
    closedAt: pull.closedAt ?? null,
    reviewDecision: pull.reviewDecision ? decisions[pull.reviewDecision] : null,
    checks: toChecks(pull.commits.nodes[0]?.commit.statusCheckRollup?.state),
    additions: pull.additions,
    deletions: pull.deletions,
    labels: pull.labels?.nodes ?? [],
    ...toReviewFields(pull),
    hasConflicts: pull.mergeable === "CONFLICTING",
    mergeState: toMergeState(pull),
    headRef: pull.headRefName,
    baseRef: pull.baseRefName,
  };
}

export function listPullRequests(
  userId: string,
  closed: ClosedWindow,
  workspaceId?: string,
) {
  const search = (token: string, query: string) =>
    searchPullRequests(token, `is:pr ${query} archived:false`).then((items) =>
      items.map(toSummary),
    );
  const since = closedSince(closed);
  // GitHub's `closed:` qualifier misses some closed PRs, so search by update
  // date (closing always updates) and keep the ones closed in the window.
  const searchClosed = async (token: string, who: string) => {
    if (since === null) return [];
    const range = since ? ` updated:>=${since}` : "";
    const items = await search(token, `${who} is:closed${range}`);
    return items.filter((pr) => (pr.closedAt ?? "").slice(0, 10) >= since);
  };
  // Open and closed are separate searches so busy closed history cannot push
  // open pull requests out of the 25-result page.
  const openAndClosed = async (token: string, who: string) => {
    const [open, done] = await Promise.all([
      search(token, `${who} is:open`),
      searchClosed(token, who),
    ]);
    return [...open, ...done];
  };
  return withGithubToken(userId, async (token) => {
    const [requested, direct, created, participated] = await Promise.all([
      search(token, "is:open review-requested:@me"),
      search(token, "is:open user-review-requested:@me"),
      openAndClosed(token, "author:@me"),
      openAndClosed(token, "involves:@me -author:@me"),
    ]);
    // review-requested includes team requests, user-review-requested does not.
    const directUrls = new Set(direct.map((pr) => pr.url));
    const toReview = requested.map((pr) => ({
      ...pr,
      teamRequested: !directUrls.has(pr.url),
    }));
    // A requested review also matches involves:@me; list it once, as waiting.
    const waiting = new Set(toReview.map((pr) => pr.url));
    const rest = participated.filter((pr) => !waiting.has(pr.url));
    const all = [...toReview, ...created, ...rest];
    const issues = await findLinkedIssues(userId, [
      ...new Set(all.map((pr) => pr.url)),
    ]);
    const reviewOwnerOf = await findReviewOwners(userId, workspaceId, all);
    const withIssue = <
      T extends { url: string; authorGithubId: number | null },
    >({
      authorGithubId: _authorGithubId,
      ...pr
    }: T) => ({
      ...pr,
      issue: issues.get(pr.url) ?? null,
      ...reviewOwnerOf(pr.url),
    });
    return {
      toReview: toReview.map(withIssue),
      created: created.map((pr) => withIssue({ ...pr, teamRequested: false })),
      participated: rest.map((pr) =>
        withIssue({ ...pr, teamRequested: false }),
      ),
    };
  });
}
