import type { Context } from "hono";
import { ApiError } from "../../errors/api-error";
import { getCallbackUrl, getClientUrl, getReviewsOAuthConfig } from "../config";
import { saveConnection } from "../connection";
import {
  exchangeCode,
  getAuthenticatedUser,
  GithubApiError,
} from "../github-api";
import { consumeOAuthState } from "../oauth-state-cookie";

export async function callback(
  c: Context,
  query: { code?: string; state?: string },
) {
  const userId = c.get("userId");
  const returnTo = consumeOAuthState(c, userId, query.state);
  if (returnTo === null) {
    throw new ApiError(400, {
      message: "The GitHub sign-in expired or did not start here. Try again.",
      code: "GITHUB_OAUTH_STATE_INVALID",
    });
  }
  const config = getReviewsOAuthConfig();
  if (!config) {
    throw new ApiError(404, {
      message: "GitHub reviews are not configured on this instance",
      code: "GITHUB_REVIEWS_NOT_CONFIGURED",
    });
  }
  const back = c.redirect(`${getClientUrl()}${returnTo}`, 302);
  // The user declined on GitHub: nothing to store, return to the page.
  if (!query.code) return back;

  try {
    const token = await exchangeCode(config, query.code, getCallbackUrl());
    const user = await getAuthenticatedUser(token.accessToken);
    await saveConnection(userId, user.id, token);
  } catch (error) {
    if (!(error instanceof GithubApiError)) throw error;
    throw new ApiError(502, {
      message: "GitHub did not accept the sign-in. Try again.",
      code: "GITHUB_OAUTH_FAILED",
    });
  }
  return back;
}
