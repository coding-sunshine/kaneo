import { type GithubSearchPull, searchPullRequests } from "../github-api";
import { withGithubToken } from "../with-github-token";

type Options = { includeDrafts: boolean; includeClosed: boolean };

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
    author: pull.author,
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
    reviewDecision: pull.reviewDecision ? decisions[pull.reviewDecision] : null,
    checks: toChecks(pull.commits.nodes[0]?.commit.statusCheckRollup?.state),
    additions: pull.additions,
    deletions: pull.deletions,
  };
}

export function listPullRequests(userId: string, options: Options) {
  const open = options.includeClosed ? "" : " is:open";
  const nonDraft = options.includeDrafts ? "" : " draft:false";
  const search = (token: string, query: string) =>
    searchPullRequests(token, `is:pr ${query} archived:false${nonDraft}`).then(
      (items) => items.map(toSummary),
    );
  return withGithubToken(userId, async (token) => {
    const [toReview, created, participated] = await Promise.all([
      search(token, "is:open review-requested:@me"),
      search(token, `author:@me${open}`),
      search(token, `involves:@me -author:@me${open}`),
    ]);
    return { toReview, created, participated };
  });
}
