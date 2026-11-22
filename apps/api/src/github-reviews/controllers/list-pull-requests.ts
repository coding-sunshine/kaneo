import { type GithubSearchItem, searchPullRequests } from "../github-api";
import { withGithubToken } from "../with-github-token";

type Options = { includeDrafts: boolean; includeClosed: boolean };

function toSummary(item: GithubSearchItem) {
  const [owner = "", repo = ""] = item.repository_url
    .split("/repos/")[1]
    ?.split("/") ?? ["", ""];
  const merged = Boolean(item.pull_request?.merged_at);
  return {
    owner,
    repo,
    number: item.number,
    title: item.title,
    url: item.html_url,
    author: item.user
      ? { login: item.user.login, avatarUrl: item.user.avatar_url }
      : null,
    status: merged
      ? ("merged" as const)
      : item.state === "closed"
        ? ("closed" as const)
        : item.draft
          ? ("draft" as const)
          : ("open" as const),
    comments: item.comments,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
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
