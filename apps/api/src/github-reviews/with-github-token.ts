import { ApiError } from "../errors/api-error";
import { GithubApiError } from "./github-api";
import { markConnectionDead, resolveConnection } from "./connection";

/** Runs a GitHub call as the user, translating connection and GitHub failures. */
export async function withGithubToken<T>(
  userId: string,
  call: (token: string) => Promise<T>,
): Promise<T> {
  const connection = await resolveConnection(userId);
  if (connection.state !== "connected") {
    throw new ApiError(409, {
      message:
        connection.state === "needs_reconnect"
          ? "Reconnect your GitHub account"
          : "Connect your GitHub account",
      code:
        connection.state === "needs_reconnect"
          ? "GITHUB_RECONNECT_REQUIRED"
          : "GITHUB_NOT_CONNECTED",
    });
  }
  try {
    return await call(connection.token);
  } catch (error) {
    if (!(error instanceof GithubApiError)) throw error;
    if (error.status === 401) {
      await markConnectionDead(userId);
      throw new ApiError(409, {
        message: "Reconnect your GitHub account",
        code: "GITHUB_RECONNECT_REQUIRED",
      });
    }
    const status = [403, 404, 422].includes(error.status) ? error.status : 502;
    throw new ApiError(status as 403 | 404 | 422 | 502, {
      message: error.message,
      code: "GITHUB_REQUEST_FAILED",
    });
  }
}
