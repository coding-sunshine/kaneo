// The only place that talks to GitHub for Reviews; tests mock this module.
const API = "https://api.github.com";
const OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";

export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type GithubTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
};

type TokenBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

const inSeconds = (seconds: number | undefined) =>
  seconds ? new Date(Date.now() + seconds * 1000) : null;

// GitHub reports OAuth failures as 200 with an `error` field.
async function requestToken(params: Record<string, string>) {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = (await response.json().catch(() => ({}))) as TokenBody;
  if (!response.ok || body.error || !body.access_token) {
    throw new GithubApiError(
      response.ok ? 400 : response.status,
      body.error_description || body.error || "GitHub token request failed",
    );
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    accessTokenExpiresAt: inSeconds(body.expires_in),
    refreshTokenExpiresAt: inSeconds(body.refresh_token_expires_in),
    scope: body.scope || null,
  } satisfies GithubTokenResponse;
}

export type OAuthClient = { clientId: string; clientSecret: string };

export function exchangeCode(
  client: OAuthClient,
  code: string,
  redirectUri: string,
) {
  return requestToken({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(client: OAuthClient, refreshToken: string) {
  return requestToken({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function githubRequest<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new GithubApiError(
      response.status,
      body.message || `GitHub responded ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

export type GithubUser = { id: number; login: string };

export const getAuthenticatedUser = (token: string) =>
  githubRequest<GithubUser>(token, "/user");

export type GithubSearchItem = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  comments: number;
  created_at: string;
  updated_at: string;
  repository_url: string;
  user: { login: string; avatar_url: string } | null;
  pull_request?: { merged_at: string | null };
};

export async function searchPullRequests(token: string, query: string) {
  const params = new URLSearchParams({
    q: query,
    sort: "updated",
    order: "desc",
    per_page: "50",
  });
  const result = await githubRequest<{ items: GithubSearchItem[] }>(
    token,
    `/search/issues?${params}`,
  );
  return result.items;
}
