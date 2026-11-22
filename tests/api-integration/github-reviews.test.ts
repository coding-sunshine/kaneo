import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const gh = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  refreshAccessToken: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  searchPullRequests: vi.fn(),
  githubRequest: vi.fn(),
}));
vi.mock("../../apps/api/src/github-reviews/github-api", async (original) => ({
  ...(await original<object>()),
  ...gh,
}));

const { app } = createApp();
const BASE = "/api/github-reviews";

const token = (over: Record<string, unknown> = {}) => ({
  accessToken: "gho_access",
  refreshToken: "ghr_refresh",
  accessTokenExpiresAt: new Date(Date.now() + 8 * 3600_000),
  refreshTokenExpiresAt: new Date(Date.now() + 180 * 86400_000),
  scope: null,
  ...over,
});

const rows = (userId: string) =>
  db
    .select()
    .from(schema.accountTable)
    .where(
      and(
        eq(schema.accountTable.userId, userId),
        eq(schema.accountTable.providerId, "github-reviews"),
      ),
    );

async function signedInUser() {
  const { user } = await createWorkspaceMember();
  mockAuthenticatedSession(user);
  return user;
}

async function connectFlow(userId: string) {
  const start = await app.request(`${BASE}/connect?returnTo=/dashboard/x`);
  const authorize = new URL(start.headers.get("location") ?? "");
  const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
  const response = await app.request(
    `${BASE}/callback?code=abc&state=${authorize.searchParams.get("state")}`,
    { headers: { cookie } },
  );
  return { start, authorize, response, userId };
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  process.env.GITHUB_APP_CLIENT_ID = "Iv1.testclient";
  process.env.GITHUB_APP_CLIENT_SECRET = "test-client-secret";
  gh.exchangeCode.mockResolvedValue(token());
  gh.getAuthenticatedUser.mockResolvedValue({ id: 4242, login: "octo" });
});

describe("connect", () => {
  it("redirects to GitHub with client_id, state and sets a state cookie", async () => {
    await signedInUser();
    const response = await app.request(`${BASE}/connect`);
    expect(response.status).toBe(302);
    const url = new URL(response.headers.get("location") ?? "");
    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("Iv1.testclient");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:1337/api/github-reviews/callback",
    );
    expect(url.searchParams.get("state")?.length).toBeGreaterThan(20);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("requires a signed-in session", async () => {
    mockAnonymousSession();
    expect((await app.request(`${BASE}/connect`)).status).toBe(401);
  });

  it("reports not configured without client credentials", async () => {
    await signedInUser();
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    const status = await app.request(`${BASE}/status`);
    expect(await status.json()).toEqual({
      state: "not_configured",
      login: null,
    });
    expect((await app.request(`${BASE}/connect`)).status).toBe(404);
  });
});

describe("callback", () => {
  it("stores one github-reviews account and returns to the web app", async () => {
    const user = await signedInUser();
    const { response } = await connectFlow(user.id);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:5173/dashboard/x",
    );
    const [row] = await rows(user.id);
    expect(row).toMatchObject({
      accountId: "4242",
      accessToken: "gho_access",
      refreshToken: "ghr_refresh",
    });
    expect(row.accessTokenExpiresAt).toBeInstanceOf(Date);
    expect(await rows(user.id)).toHaveLength(1);
  });

  it("re-connecting updates the same single row", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    gh.exchangeCode.mockResolvedValue(token({ accessToken: "gho_second" }));
    await connectFlow(user.id);
    const all = await rows(user.id);
    expect(all).toHaveLength(1);
    expect(all[0].accessToken).toBe("gho_second");
  });

  it("rejects a state that does not match the cookie", async () => {
    const user = await signedInUser();
    const start = await app.request(`${BASE}/connect`);
    const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
    const response = await app.request(
      `${BASE}/callback?code=abc&state=forged`,
      {
        headers: { cookie },
      },
    );
    expect(response.status).toBe(400);
    expect(gh.exchangeCode).not.toHaveBeenCalled();
    expect(await rows(user.id)).toHaveLength(0);
  });

  it("rejects a callback with no state cookie", async () => {
    await signedInUser();
    const response = await app.request(`${BASE}/callback?code=abc&state=x`);
    expect(response.status).toBe(400);
  });

  it("rejects a state cookie minted by another user's session", async () => {
    const first = await signedInUser();
    const start = await app.request(`${BASE}/connect`);
    const state = new URL(start.headers.get("location") ?? "").searchParams.get(
      "state",
    );
    const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
    const second = await signedInUser();
    const response = await app.request(
      `${BASE}/callback?code=abc&state=${state}`,
      {
        headers: { cookie },
      },
    );
    expect(response.status).toBe(400);
    expect(await rows(first.id)).toHaveLength(0);
    expect(await rows(second.id)).toHaveLength(0);
  });

  it("never redirects off the web app", async () => {
    const user = await signedInUser();
    const start = await app.request(`${BASE}/connect?returnTo=//evil.example`);
    const state = new URL(start.headers.get("location") ?? "").searchParams.get(
      "state",
    );
    const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
    const response = await app.request(`${BASE}/callback?state=${state}`, {
      headers: { cookie },
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost:5173/dashboard",
    );
    expect(await rows(user.id)).toHaveLength(0);
  });
});

describe("status, refresh and disconnect", () => {
  it("walks never connected, connected, and disconnected", async () => {
    const user = await signedInUser();
    const status = async () => (await app.request(`${BASE}/status`)).json();
    expect(await status()).toEqual({ state: "not_connected", login: null });
    await connectFlow(user.id);
    expect(await status()).toEqual({ state: "connected", login: "octo" });
    const response = await app.request(`${BASE}/connection`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(await rows(user.id)).toHaveLength(0);
    expect(await status()).toEqual({ state: "not_connected", login: null });
  });

  it("refreshes an expired token and keeps one row", async () => {
    const user = await signedInUser();
    gh.exchangeCode.mockResolvedValue(
      token({ accessTokenExpiresAt: new Date(Date.now() - 1000) }),
    );
    await connectFlow(user.id);
    gh.refreshAccessToken.mockResolvedValue(
      token({ accessToken: "gho_fresh", refreshToken: "ghr_next" }),
    );
    const response = await app.request(`${BASE}/status`);
    expect(await response.json()).toEqual({
      state: "connected",
      login: "octo",
    });
    expect(gh.refreshAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "Iv1.testclient" }),
      "ghr_refresh",
    );
    expect(gh.getAuthenticatedUser).toHaveBeenLastCalledWith("gho_fresh");
    const all = await rows(user.id);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      accessToken: "gho_fresh",
      refreshToken: "ghr_next",
    });
  });

  it("reports reconnect when the refresh fails, and keeps the row", async () => {
    const user = await signedInUser();
    gh.exchangeCode.mockResolvedValue(
      token({ accessTokenExpiresAt: new Date(Date.now() - 1000) }),
    );
    await connectFlow(user.id);
    const { GithubApiError } = await vi.importActual<
      typeof import("../../apps/api/src/github-reviews/github-api")
    >("../../apps/api/src/github-reviews/github-api");
    gh.refreshAccessToken.mockRejectedValue(
      new GithubApiError(400, "bad_refresh_token"),
    );
    const status = await app.request(`${BASE}/status`);
    expect(await status.json()).toEqual({
      state: "needs_reconnect",
      login: null,
    });
    const [row] = await rows(user.id);
    expect(row.accessToken).toBeNull();
    const list = await app.request(BASE);
    expect(list.status).toBe(409);
    expect((await list.json()).code).toBe("GITHUB_RECONNECT_REQUIRED");
  });
});

describe("list", () => {
  const item = (n: number, over: Record<string, unknown> = {}) => ({
    number: n,
    title: `PR ${n}`,
    html_url: `https://github.com/acme/web/pull/${n}`,
    state: "open",
    comments: 2,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    repository_url: "https://api.github.com/repos/acme/web",
    user: { login: "ada", avatar_url: "https://avatars.test/ada" },
    ...over,
  });

  it("returns the three groups from the user's own token", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    gh.searchPullRequests.mockImplementation(async (_token, query: string) =>
      query.includes("review-requested:@me")
        ? [item(1, { draft: false })]
        : query.includes("author:@me") && !query.includes("-author")
          ? [
              item(2, { draft: true }),
              item(3, { pull_request: { merged_at: "x" } }),
            ]
          : [item(4, { state: "closed" })],
    );
    const response = await app.request(
      `${BASE}?includeDrafts=true&includeClosed=true`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.toReview.map((pr: { number: number }) => pr.number)).toEqual([
      1,
    ]);
    expect(body.created.map((pr: { status: string }) => pr.status)).toEqual([
      "draft",
      "merged",
    ]);
    expect(body.participated[0]).toMatchObject({
      owner: "acme",
      repo: "web",
      status: "closed",
      author: { login: "ada" },
    });
    expect(gh.searchPullRequests).toHaveBeenCalledTimes(3);
    for (const call of gh.searchPullRequests.mock.calls) {
      expect(call[0]).toBe("gho_access");
    }
  });

  it("hides drafts and closed pull requests unless asked", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    gh.searchPullRequests.mockResolvedValue([]);
    await app.request(BASE);
    const queries = gh.searchPullRequests.mock.calls.map((call) => call[1]);
    expect(queries).toEqual([
      "is:pr is:open review-requested:@me archived:false draft:false",
      "is:pr author:@me is:open archived:false draft:false",
      "is:pr involves:@me -author:@me is:open archived:false draft:false",
    ]);
  });

  it("does not give another user your pull requests or token", async () => {
    const owner = await signedInUser();
    await connectFlow(owner.id);
    const other = await signedInUser();
    const list = await app.request(BASE);
    expect(list.status).toBe(409);
    expect((await list.json()).code).toBe("GITHUB_NOT_CONNECTED");
    expect(gh.searchPullRequests).not.toHaveBeenCalled();
    expect(await rows(other.id)).toHaveLength(0);
  });

  it("marks the connection dead when GitHub rejects the token", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    const { GithubApiError } = await vi.importActual<
      typeof import("../../apps/api/src/github-reviews/github-api")
    >("../../apps/api/src/github-reviews/github-api");
    gh.searchPullRequests.mockRejectedValue(
      new GithubApiError(401, "Bad credentials"),
    );
    expect((await app.request(BASE)).status).toBe(409);
    const status = await app.request(`${BASE}/status`);
    expect((await status.json()).state).toBe("needs_reconnect");
  });
});
