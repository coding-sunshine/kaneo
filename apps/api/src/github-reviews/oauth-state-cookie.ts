import { oauthStateCookie } from "../utils/oauth-state-cookie";

export const reviewsOAuthState = oauthStateCookie<{ returnTo: string }>(
  "kaneo_github_reviews_oauth",
  "/api/github-reviews",
);
