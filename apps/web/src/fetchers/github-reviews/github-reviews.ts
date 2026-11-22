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

export async function getReviewsList(options: {
  includeDrafts: boolean;
  includeClosed: boolean;
}): Promise<ReviewsList> {
  const response = await client["github-reviews"].$get({
    query: {
      includeDrafts: options.includeDrafts ? "true" : "false",
      includeClosed: options.includeClosed ? "true" : "false",
    },
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
