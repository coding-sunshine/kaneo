import { getReviewsOAuthConfig } from "../config";
import { markConnectionDead, resolveConnection } from "../connection";
import { getAuthenticatedUser, GithubApiError } from "../github-api";

type Status = {
  state: "not_configured" | "not_connected" | "needs_reconnect" | "connected";
  login: string | null;
};

export async function getStatus(userId: string): Promise<Status> {
  if (!getReviewsOAuthConfig()) return { state: "not_configured", login: null };
  const connection = await resolveConnection(userId);
  if (connection.state !== "connected") {
    return { state: connection.state, login: null };
  }
  // Doubles as a liveness check: a revoked token answers 401.
  try {
    const user = await getAuthenticatedUser(connection.token);
    return { state: "connected", login: user.login };
  } catch (error) {
    if (!(error instanceof GithubApiError) || error.status !== 401) throw error;
    await markConnectionDead(userId);
    return { state: "needs_reconnect", login: null };
  }
}
