import type { Context } from "hono";
import { ApiError } from "../../errors/api-error";
import {
  getCallbackUrl,
  getReviewsOAuthConfig,
  safeReturnPath,
} from "../config";
import { startOAuthState } from "../oauth-state-cookie";

export function connect(c: Context, returnTo: string | undefined) {
  const config = getReviewsOAuthConfig();
  if (!config) {
    throw new ApiError(404, {
      message: "GitHub reviews are not configured on this instance",
      code: "GITHUB_REVIEWS_NOT_CONFIGURED",
    });
  }
  const state = startOAuthState(c, c.get("userId"), safeReturnPath(returnTo));
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", getCallbackUrl());
  url.searchParams.set("state", state);
  return c.redirect(url.toString(), 302);
}
