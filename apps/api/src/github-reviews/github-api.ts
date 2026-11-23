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

export type GithubSearchPull = {
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  comments: { totalCount: number };
  author: { login: string; avatarUrl: string } | null;
  repository: { name: string; owner: { login: string } };
  commits: {
    nodes: { commit: { statusCheckRollup: { state: string } | null } }[];
  };
};

// 50 results with each PR's check rollup took ~10s for a busy author and hit
// GitHub's GraphQL timeout (502); 25 returns in ~2.5s.
// ponytail: newest 25 per group, paginate with a cursor if people need older PRs.
const SEARCH_QUERY = `query($q: String!) {
  search(query: $q, type: ISSUE, first: 25) {
    nodes {
      ... on PullRequest {
        number title url state isDraft createdAt updatedAt additions deletions
        reviewDecision
        comments { totalCount }
        author { login avatarUrl }
        repository { name owner { login } }
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
      }
    }
  }
}`;

const postSearch = (token: string, query: string) =>
  fetch(`${API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { q: `${query} sort:updated-desc` },
    }),
  });

export async function searchPullRequests(token: string, query: string) {
  let response = await postSearch(token, query);
  // Broad searches (closed PRs included) sometimes hit GitHub's GraphQL
  // timeout and come back 502; a second try usually lands.
  if (response.status === 502 || response.status === 504) {
    response = await postSearch(token, query);
  }
  const body = (await response.json().catch(() => ({}))) as {
    data?: { search: { nodes: Partial<GithubSearchPull>[] } };
    errors?: { message: string }[];
    message?: string;
  };
  if (!response.ok) {
    throw new GithubApiError(
      response.status,
      body.message || `GitHub responded ${response.status}`,
    );
  }
  if (!body.data) {
    // GraphQL reports failures as HTTP 200 with an errors array.
    throw new GithubApiError(
      502,
      body.errors?.[0]?.message ?? "GitHub GraphQL returned no data",
    );
  }
  // Non-pull results (none, given is:pr) come back as empty objects.
  return body.data.search.nodes.filter(
    (node): node is GithubSearchPull => typeof node.number === "number",
  );
}

type GithubPerson = { login: string; avatar_url: string } | null;

export type GithubPull = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  comments: number;
  created_at: string;
  updated_at: string;
  user: GithubPerson;
  labels: { name: string; color: string }[];
  head: { sha: string; ref: string };
  base: { ref: string };
  additions: number;
  deletions: number;
  changed_files: number;
};

const pullPath = (owner: string, repo: string, number: string) =>
  `/repos/${owner}/${repo}/pulls/${number}`;

export const getPull = (
  token: string,
  owner: string,
  repo: string,
  number: string,
) => githubRequest<GithubPull>(token, pullPath(owner, repo, number));

export type GithubFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

const FILES_PAGE = 100;
// GitHub serves at most 3000 files per pull request.
const FILES_MAX_PAGES = 30;

export async function listPullFiles(
  token: string,
  owner: string,
  repo: string,
  number: string,
) {
  const files: GithubFile[] = [];
  for (let page = 1; page <= FILES_MAX_PAGES; page++) {
    const batch = await githubRequest<GithubFile[]>(
      token,
      `${pullPath(owner, repo, number)}/files?per_page=${FILES_PAGE}&page=${page}`,
    );
    files.push(...batch);
    if (batch.length < FILES_PAGE) break;
  }
  return files;
}

export type GithubCheckRun = {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
};

export const listCheckRuns = (
  token: string,
  owner: string,
  repo: string,
  sha: string,
) =>
  githubRequest<{ check_runs: GithubCheckRun[] }>(
    token,
    `/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`,
  );

export type GithubCombinedStatus = {
  statuses: {
    context: string;
    state: "success" | "failure" | "error" | "pending";
    target_url: string | null;
  }[];
};

export const getCombinedStatus = (
  token: string,
  owner: string,
  repo: string,
  sha: string,
) =>
  githubRequest<GithubCombinedStatus>(
    token,
    `/repos/${owner}/${repo}/commits/${sha}/status`,
  );

export type GithubIssueComment = {
  id: number;
  user: GithubPerson;
  body: string;
  created_at: string;
};

export const listIssueComments = (
  token: string,
  owner: string,
  repo: string,
  number: string,
) =>
  githubRequest<GithubIssueComment[]>(
    token,
    `/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`,
  );

export type GithubReview = {
  id: number;
  user: GithubPerson;
  body: string;
  state: string;
  submitted_at: string | null;
};

export const listReviews = (
  token: string,
  owner: string,
  repo: string,
  number: string,
) =>
  githubRequest<GithubReview[]>(
    token,
    `${pullPath(owner, repo, number)}/reviews?per_page=100`,
  );

export const submitReview = (
  token: string,
  owner: string,
  repo: string,
  number: string,
  review: { event: string; body: string },
) =>
  githubRequest<{ id: number }>(
    token,
    `${pullPath(owner, repo, number)}/reviews`,
    { method: "POST", body: review },
  );

export type GithubReviewComment = {
  id: number;
  user: GithubPerson;
  body: string;
  path: string;
  // line is null once the commented code is outdated.
  line: number | null;
  original_line: number | null;
  side: "LEFT" | "RIGHT";
  created_at: string;
};

export const listReviewComments = (
  token: string,
  owner: string,
  repo: string,
  number: string,
) =>
  githubRequest<GithubReviewComment[]>(
    token,
    `${pullPath(owner, repo, number)}/comments?per_page=100`,
  );

export const addIssueComment = (
  token: string,
  owner: string,
  repo: string,
  number: string,
  body: string,
) =>
  githubRequest<{ id: number }>(
    token,
    `/repos/${owner}/${repo}/issues/${number}/comments`,
    { method: "POST", body: { body } },
  );

export const mergePull = (
  token: string,
  owner: string,
  repo: string,
  number: string,
  mergeMethod: string,
) =>
  githubRequest<{ merged: boolean }>(
    token,
    `${pullPath(owner, repo, number)}/merge`,
    { method: "PUT", body: { merge_method: mergeMethod } },
  );
