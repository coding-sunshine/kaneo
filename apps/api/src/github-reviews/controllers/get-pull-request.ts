import { getPull } from "../github-api";
import { findLinkedIssues } from "../linked-issues";
import { findReviewOwners } from "../review-owners";
import { withGithubToken } from "../with-github-token";

export const person = (user: { login: string; avatar_url: string } | null) =>
  user ? { login: user.login, avatarUrl: user.avatar_url } : null;

export async function getPullRequest(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  workspaceId?: string,
) {
  const pull = await withGithubToken(userId, (token) =>
    getPull(token, owner, repo, number),
  );
  const issues = await findLinkedIssues(userId, [pull.html_url]);
  const reviewOwnerOf = await findReviewOwners(userId, workspaceId, [
    { url: pull.html_url, authorGithubId: pull.user?.id ?? null },
  ]);
  return {
    owner,
    repo,
    number: pull.number,
    title: pull.title,
    url: pull.html_url,
    author: person(pull.user),
    status: pull.merged
      ? ("merged" as const)
      : pull.state === "closed"
        ? ("closed" as const)
        : pull.draft
          ? ("draft" as const)
          : ("open" as const),
    comments: pull.comments ?? 0,
    createdAt: pull.created_at,
    updatedAt: pull.updated_at,
    closedAt: pull.closed_at,
    body: pull.body ?? "",
    mergeable:
      pull.state === "open" && !pull.draft ? (pull.mergeable ?? null) : false,
    labels: pull.labels,
    headSha: pull.head.sha,
    headRef: pull.head.ref,
    baseRef: pull.base.ref,
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: pull.changed_files,
    requestedReviewers: pull.requested_reviewers.map((user) => ({
      login: user.login,
      avatarUrl: user.avatar_url,
    })),
    issue: issues.get(pull.html_url) ?? null,
    ...reviewOwnerOf(pull.html_url),
  };
}
