import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export type ReviewsStatus = InferResponseType<
  (typeof client)["github-reviews"]["status"]["$get"],
  200
>;
export type ReviewsList = InferResponseType<
  (typeof client)["github-reviews"]["$get"],
  200
>;
export type ReviewPullRequest = ReviewsList["created"][number];

export async function getReviewsStatus(): Promise<ReviewsStatus> {
  const response = await client["github-reviews"].status.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

/** How far back merged and closed pull requests are listed. */
export type ClosedWindow = "all" | "day" | "week" | "month" | "none";

export async function getReviewsList(
  closed: ClosedWindow,
): Promise<ReviewsList> {
  const response = await client["github-reviews"].$get({
    query: { closed },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function disconnectReviews() {
  const response = await client["github-reviews"].connection.$delete();
  if (!response.ok) throw await HttpError.fromResponse(response);
}

// The OAuth round trip is a browser navigation: the session cookie must reach
// the API and GitHub redirects back, so the fetch client cannot be used.
export function getReviewsConnectUrl(returnTo: string) {
  return getApiUrl(
    `github-reviews/connect?returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export type PullRef = { owner: string; repo: string; number: string };
const pull = (_ref: PullRef) =>
  client["github-reviews"].pulls[":owner"][":repo"][":number"];

export type PullRequestDetail = InferResponseType<
  ReturnType<typeof pull>["$get"],
  200
>;
export type PullRequestFiles = InferResponseType<
  ReturnType<typeof pull>["files"]["$get"],
  200
>;
export type PullRequestCommits = InferResponseType<
  ReturnType<typeof pull>["commits"]["$get"],
  200
>;
export type PullRequestChecks = InferResponseType<
  ReturnType<typeof pull>["checks"]["$get"],
  200
>;
export type PullRequestConversation = InferResponseType<
  ReturnType<typeof pull>["conversation"]["$get"],
  200
>;
export type ConversationEntry = PullRequestConversation[number];
export type ReviewerCandidates = InferResponseType<
  ReturnType<typeof pull>["reviewers"]["$get"],
  200
>;
export type RepoLabels = InferResponseType<
  (typeof client)["github-reviews"]["repos"][":owner"][":repo"]["labels"]["$get"],
  200
>;
export type MergeMethod = "merge" | "squash" | "rebase";
export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

const param = (ref: PullRef) => ({ param: ref });

export async function getPullRequest(ref: PullRef) {
  const response = await pull(ref).$get(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getPullRequestFiles(ref: PullRef) {
  const response = await pull(ref).files.$get(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getPullRequestCommits(ref: PullRef) {
  const response = await pull(ref).commits.$get(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function comparePullRequestCommits(
  ref: PullRef,
  base: string,
  head: string,
) {
  const response = await pull(ref).compare.$get({
    ...param(ref),
    query: { base, head },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getPullRequestFileContent(
  ref: PullRef,
  path: string,
  sha: string,
) {
  const response = await pull(ref).content.$get({
    ...param(ref),
    query: { path, ref: sha },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getPullRequestChecks(ref: PullRef) {
  const response = await pull(ref).checks.$get(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function getPullRequestConversation(ref: PullRef) {
  const response = await pull(ref).conversation.$get(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function submitPullRequestReview(
  ref: PullRef,
  review: { event: ReviewEvent; body: string },
) {
  const response = await pull(ref).reviews.$post({
    ...param(ref),
    json: review,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function addPullRequestComment(ref: PullRef, body: string) {
  const response = await pull(ref).comments.$post({
    ...param(ref),
    json: { body },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function mergePullRequest(ref: PullRef, mergeMethod: MergeMethod) {
  const response = await pull(ref).merge.$put({
    ...param(ref),
    json: { mergeMethod },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function getReviewerCandidates(ref: PullRef) {
  const response = await pull(ref).reviewers.$get(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function requestPullRequestReviewers(
  ref: PullRef,
  reviewers: string[],
) {
  const response = await pull(ref).reviewers.$post({
    ...param(ref),
    json: { reviewers },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function markPullRequestReady(ref: PullRef) {
  const response = await pull(ref).ready.$post(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function convertPullRequestToDraft(ref: PullRef) {
  const response = await pull(ref).draft.$post(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function closePullRequest(ref: PullRef) {
  const response = await pull(ref).close.$post(param(ref));
  if (!response.ok) throw await HttpError.fromResponse(response);
}

export async function getRepoLabels(ref: PullRef) {
  const response = await client["github-reviews"].repos[":owner"][
    ":repo"
  ].labels.$get({ param: ref });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function setPullRequestLabels(ref: PullRef, labels: string[]) {
  const response = await pull(ref).labels.$put({
    ...param(ref),
    json: { labels },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
}
