import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const gh = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  refreshAccessToken: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  searchPullRequests: vi.fn(),
  githubRequest: vi.fn(),
  getPull: vi.fn(),
  listPullFiles: vi.fn(),
  listPullCommits: vi.fn(),
  compareCommits: vi.fn(),
  getFileContent: vi.fn(),
  listCheckRuns: vi.fn(),
  getCombinedStatus: vi.fn(),
  listIssueComments: vi.fn(),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  listReviewComments: vi.fn(),
  addIssueComment: vi.fn(),
  mergePull: vi.fn(),
  listAssignees: vi.fn(),
  requestReviewers: vi.fn(),
  markReadyForReview: vi.fn(),
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
    url: `https://github.com/acme/web/pull/${n}`,
    state: "OPEN",
    isDraft: false,
    comments: { totalCount: 2 },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    closedAt: null,
    additions: 10,
    deletions: 2,
    reviewDecision: null,
    repository: { name: "web", owner: { login: "acme" } },
    author: { login: "ada", avatarUrl: "https://avatars.test/ada" },
    commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    ...over,
  });

  it("returns the three groups from the user's own token", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    gh.searchPullRequests.mockImplementation(async (_token, query: string) =>
      query.includes("review-requested:@me")
        ? [
            item(1, {
              reviewDecision: "CHANGES_REQUESTED",
              commits: {
                nodes: [
                  { commit: { statusCheckRollup: { state: "FAILURE" } } },
                ],
              },
            }),
          ]
        : query.includes("-author")
          ? query.includes("is:closed")
            ? [item(4, { state: "CLOSED", closedAt: "2026-01-03T00:00:00Z" })]
            : [item(1)]
          : query.includes("is:closed")
            ? [item(3, { state: "MERGED", closedAt: "2026-01-03T00:00:00Z" })]
            : [item(2, { isDraft: true })],
    );
    const response = await app.request(`${BASE}?closed=all`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.toReview).toHaveLength(1);
    expect(body.toReview[0]).toMatchObject({
      number: 1,
      reviewDecision: "changes_requested",
      checks: "failure",
      additions: 10,
      deletions: 2,
    });
    expect(body.created[0].checks).toBe("none");
    expect(body.created.map((pr: { status: string }) => pr.status)).toEqual([
      "draft",
      "merged",
    ]);
    // #1 is both requested and involved; it shows once, under toReview.
    expect(body.participated).toHaveLength(1);
    expect(body.participated[0]).toMatchObject({
      owner: "acme",
      repo: "web",
      status: "closed",
      closedAt: "2026-01-03T00:00:00Z",
      author: { login: "ada" },
    });
    expect(gh.searchPullRequests).toHaveBeenCalledTimes(6);
    for (const call of gh.searchPullRequests.mock.calls) {
      expect(call[0]).toBe("gho_access");
    }
  });

  it("adds reviewers, labels, merge state, team requests and the linked task", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    await connectFlow(user.id);
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Platform",
    });
    const [work] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: workspace.id, name: "Launch" })
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Ship it",
        priority: "urgent",
        workProjectId: work.id,
      })
      .returning();
    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      resourceType: "pull_request",
      externalId: "1",
      url: "https://github.com/acme/web/pull/1",
    });
    const rich = item(1, {
      mergeable: "CONFLICTING",
      mergeStateStatus: "BLOCKED",
      labels: { nodes: [{ name: "bug", color: "d73a4a" }] },
      reviewRequests: {
        nodes: [
          { requestedReviewer: { __typename: "Team", slug: "core" } },
          {
            requestedReviewer: {
              __typename: "User",
              login: "bo",
              avatarUrl: "https://avatars.test/bo",
            },
          },
        ],
      },
      latestOpinionatedReviews: {
        nodes: [
          {
            state: "APPROVED",
            author: { login: "cy", avatarUrl: "https://avatars.test/cy" },
          },
        ],
      },
    });
    gh.searchPullRequests.mockImplementation(async (_token, query: string) =>
      query.includes("user-review-requested:@me")
        ? []
        : query.includes("review-requested:@me")
          ? [rich]
          : [],
    );
    const body = await (await app.request(`${BASE}?closed=none`)).json();
    expect(body.toReview[0]).toMatchObject({
      teamRequested: true,
      hasConflicts: true,
      mergeState: "blocked",
      labels: [{ name: "bug", color: "d73a4a" }],
      teamReviewers: ["core"],
      approvedBy: ["cy"],
      issue: {
        taskId: task.id,
        priority: "urgent",
        team: { name: "Platform" },
        project: { name: "Launch" },
      },
    });
    expect(
      body.toReview[0].reviewers.map((p: { login: string }) => p.login),
    ).toEqual(["bo", "cy"]);
  });

  it("does not link a task from a workspace the user is not in", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    const other = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Theirs" })
      .returning();
    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      resourceType: "pull_request",
      externalId: "1",
      url: "https://github.com/acme/web/pull/1",
    });
    gh.searchPullRequests.mockImplementation(async (_token, query: string) =>
      query.includes("review-requested:@me") ? [item(1)] : [],
    );
    const body = await (await app.request(`${BASE}?closed=none`)).json();
    expect(body.toReview[0]).toMatchObject({
      teamRequested: false,
      issue: null,
    });
  });

  it("includes drafts and the past week of closed pull requests by default", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    const daysAgo = (days: number) =>
      new Date(Date.now() - days * 86_400_000).toISOString();
    // GitHub's closed: qualifier misses some PRs, so the API searches by
    // update date and drops ones closed before the window.
    gh.searchPullRequests.mockImplementation(async (_token, query: string) =>
      query.includes("author:@me is:closed")
        ? [
            item(5, { state: "MERGED", closedAt: daysAgo(1) }),
            item(6, { state: "CLOSED", closedAt: daysAgo(30) }),
          ]
        : [],
    );
    const response = await app.request(BASE);
    const body = await response.json();
    expect(body.created.map((pr: { number: number }) => pr.number)).toEqual([
      5,
    ]);
    const since = daysAgo(7).slice(0, 10);
    const queries = gh.searchPullRequests.mock.calls.map((call) => call[1]);
    expect(queries.sort()).toEqual(
      [
        "is:pr is:open review-requested:@me archived:false",
        "is:pr is:open user-review-requested:@me archived:false",
        "is:pr author:@me is:open archived:false",
        `is:pr author:@me is:closed updated:>=${since} archived:false`,
        "is:pr involves:@me -author:@me is:open archived:false",
        `is:pr involves:@me -author:@me is:closed updated:>=${since} archived:false`,
      ].sort(),
    );
  });

  it("skips closed pull requests when the window is none", async () => {
    const user = await signedInUser();
    await connectFlow(user.id);
    gh.searchPullRequests.mockResolvedValue([]);
    await app.request(`${BASE}?closed=none`);
    const queries = gh.searchPullRequests.mock.calls.map((call) => call[1]);
    expect(queries.some((query) => query.includes("is:closed"))).toBe(false);
    expect(queries).toHaveLength(4);
  });

  it("reads the search through GraphQL and pages the files list", async () => {
    const actual = await vi.importActual<
      typeof import("../../apps/api/src/github-reviews/github-api")
    >("../../apps/api/src/github-reviews/github-api");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ data: { search: { nodes: [item(1), {}] } } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const found = await actual.searchPullRequests("tok", "is:pr x");
      expect(found).toHaveLength(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.github.com/graphql");
      expect(JSON.parse(init.body).variables.q).toBe(
        "is:pr x sort:updated-desc",
      );

      const file = (i: number) => ({
        filename: `f${i}`,
        status: "added",
        additions: 1,
        deletions: 0,
      });
      fetchMock
        .mockResolvedValueOnce(
          Response.json(Array.from({ length: 100 }, (_, i) => file(i))),
        )
        .mockResolvedValueOnce(Response.json([file(100), file(101)]));
      const files = await actual.listPullFiles("tok", "a", "b", "1");
      expect(files).toHaveLength(102);
      expect(fetchMock.mock.calls[2][0]).toContain("page=2");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retries a search once when GitHub times out", async () => {
    const actual = await vi.importActual<
      typeof import("../../apps/api/src/github-reviews/github-api")
    >("../../apps/api/src/github-reviews/github-api");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(
        Response.json({ data: { search: { nodes: [item(1)] } } }),
      )
      .mockResolvedValue(new Response("", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      expect(await actual.searchPullRequests("tok", "is:pr x")).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await expect(
        actual.searchPullRequests("tok", "is:pr x"),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
    }
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

describe("pull request detail", () => {
  const P = `${BASE}/pulls/acme/web/7`;
  const pull = {
    node_id: "PR_node7",
    number: 7,
    title: "Add thing",
    body: null,
    html_url: "https://github.com/acme/web/pull/7",
    state: "open",
    draft: false,
    merged: false,
    mergeable: true,
    comments: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    closed_at: null,
    user: { login: "ada", avatar_url: "a" },
    requested_reviewers: [{ login: "cy", avatar_url: "c" }],
    labels: [],
    head: { sha: "abc", ref: "feat" },
    base: { ref: "main" },
    additions: 3,
    deletions: 1,
    changed_files: 2,
  };

  async function connected() {
    const user = await signedInUser();
    await connectFlow(user.id);
    return user;
  }

  it("returns details, files with null patches, checks and conversation", async () => {
    await connected();
    gh.getPull.mockResolvedValue(pull);
    gh.listPullFiles.mockResolvedValue([
      {
        filename: "a.ts",
        status: "modified",
        additions: 2,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-a\n+b",
      },
      { filename: "img.png", status: "added", additions: 0, deletions: 0 },
    ]);
    gh.listCheckRuns.mockResolvedValue({
      check_runs: [
        {
          name: "ci",
          status: "completed",
          conclusion: "failure",
          html_url: "u",
        },
      ],
    });
    gh.getCombinedStatus.mockResolvedValue({ statuses: [] });
    gh.listReviewComments.mockResolvedValue([
      {
        id: 9,
        user: { login: "cy", avatar_url: "c" },
        body: "nit",
        path: "a.ts",
        line: null,
        original_line: 4,
        side: "RIGHT",
        created_at: "2026-01-02T12:00:00Z",
      },
    ]);
    gh.listIssueComments.mockResolvedValue([
      {
        id: 1,
        user: { login: "bob", avatar_url: "b" },
        body: "hi",
        created_at: "2026-01-02T00:00:00Z",
      },
    ]);
    gh.listReviews.mockResolvedValue([
      {
        id: 2,
        user: null,
        body: "",
        state: "COMMENTED",
        submitted_at: "2026-01-03T00:00:00Z",
      },
      {
        id: 3,
        user: null,
        body: "",
        state: "APPROVED",
        submitted_at: "2026-01-04T00:00:00Z",
      },
    ]);

    expect(await (await app.request(P)).json()).toMatchObject({
      number: 7,
      status: "open",
      body: "",
      headSha: "abc",
      mergeable: true,
      labels: [],
      additions: 3,
      deletions: 1,
      closedAt: null,
      requestedReviewers: [{ login: "cy", avatarUrl: "c" }],
    });
    const files = await (await app.request(`${P}/files`)).json();
    expect(
      files.map((file: { patch: string | null }) => file.patch === null),
    ).toEqual([false, true]);
    expect(await (await app.request(`${P}/checks`)).json()).toMatchObject({
      state: "failure",
      checks: [{ name: "ci", state: "failure" }],
    });
    const conversation = await (await app.request(`${P}/conversation`)).json();
    expect(conversation.map((entry: { id: string }) => entry.id)).toEqual([
      "comment-1",
      "review-comment-9",
      "review-3",
    ]);
    expect(conversation[1]).toMatchObject({
      kind: "review_comment",
      path: "a.ts",
      line: 4,
      side: "RIGHT",
    });
  });

  it("lists commits, compares a range and reads file text at a commit", async () => {
    await connected();
    gh.listPullCommits.mockResolvedValue([
      {
        sha: "a".repeat(40),
        commit: { message: "first\n\nbody", author: { date: "2026-01-01" } },
        parents: [{ sha: "b".repeat(40) }],
        author: null,
      },
    ]);
    expect(await (await app.request(`${P}/commits`)).json()).toEqual([
      {
        sha: "a".repeat(40),
        title: "first",
        date: "2026-01-01",
        parent: "b".repeat(40),
      },
    ]);

    gh.compareCommits.mockResolvedValue({
      files: [
        { filename: "a.ts", status: "added", additions: 1, deletions: 0 },
      ],
    });
    const compare = await app.request(
      `${P}/compare?base=${"b".repeat(40)}&head=${"a".repeat(40)}`,
    );
    expect(await compare.json()).toEqual([
      {
        filename: "a.ts",
        status: "added",
        additions: 1,
        deletions: 0,
        patch: null,
      },
    ]);
    expect((await app.request(`${P}/compare?base=x&head=y`)).status).toBe(400);

    const ref = "a".repeat(40);
    gh.getFileContent.mockResolvedValue({
      type: "file",
      content: Buffer.from("one\ntwo\n").toString("base64"),
    });
    expect(
      await (
        await app.request(`${P}/content?path=src/a%20b.ts&ref=${ref}`)
      ).json(),
    ).toEqual({ content: "one\ntwo\n" });
    expect(gh.getFileContent).toHaveBeenCalledWith(
      "gho_access",
      "acme",
      "web",
      "src/a b.ts",
      ref,
    );
    gh.getFileContent.mockResolvedValue({
      type: "file",
      content: Buffer.from("a\0b").toString("base64"),
    });
    expect(
      await (await app.request(`${P}/content?path=x.bin&ref=${ref}`)).json(),
    ).toEqual({ content: null });
  });

  it("posts the review to GitHub as the user and requires a body unless approving", async () => {
    await connected();
    gh.submitReview.mockResolvedValue({ id: 1 });
    const post = (body: object) =>
      app.request(`${P}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await post({ event: "REQUEST_CHANGES", body: "" })).status).toBe(
      400,
    );
    expect((await post({ event: "APPROVE" })).status).toBe(200);
    expect(gh.submitReview).toHaveBeenCalledWith(
      "gho_access",
      "acme",
      "web",
      "7",
      {
        event: "APPROVE",
        body: "",
      },
    );
  });

  it("adds a conversation comment as the user and refuses an empty one", async () => {
    await connected();
    gh.addIssueComment.mockResolvedValue({ id: 5 });
    const post = (body: object) =>
      app.request(`${P}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await post({ body: "  " })).status).toBe(400);
    expect(gh.addIssueComment).not.toHaveBeenCalled();
    expect((await post({ body: "looks good" })).status).toBe(200);
    expect(gh.addIssueComment).toHaveBeenCalledWith(
      "gho_access",
      "acme",
      "web",
      "7",
      "looks good",
    );
  });

  it("submits each review event with its body", async () => {
    await connected();
    gh.submitReview.mockResolvedValue({ id: 1 });
    for (const event of ["COMMENT", "REQUEST_CHANGES", "APPROVE"]) {
      const response = await app.request(`${P}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event, body: "note" }),
      });
      expect(response.status).toBe(200);
    }
    expect(gh.submitReview.mock.calls.map((call) => call[4])).toEqual([
      { event: "COMMENT", body: "note" },
      { event: "REQUEST_CHANGES", body: "note" },
      { event: "APPROVE", body: "note" },
    ]);
  });

  it("merges with the chosen method and maps GitHub's 405 and 403", async () => {
    await connected();
    const put = (body: object = {}) =>
      app.request(`${P}/merge`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    gh.mergePull.mockResolvedValueOnce({ merged: true });
    expect((await put({ mergeMethod: "squash" })).status).toBe(200);
    expect(gh.mergePull).toHaveBeenLastCalledWith(
      "gho_access",
      "acme",
      "web",
      "7",
      "squash",
    );

    const { GithubApiError } = await vi.importActual<
      typeof import("../../apps/api/src/github-reviews/github-api")
    >("../../apps/api/src/github-reviews/github-api");
    gh.mergePull.mockRejectedValueOnce(
      new GithubApiError(405, "Pull Request is not mergeable"),
    );
    const notMergeable = await put();
    expect(notMergeable.status).toBe(405);
    expect((await notMergeable.json()).message).toBe(
      "Pull Request is not mergeable",
    );
    expect(gh.mergePull).toHaveBeenLastCalledWith(
      "gho_access",
      "acme",
      "web",
      "7",
      "merge",
    );

    gh.mergePull.mockRejectedValueOnce(
      new GithubApiError(403, "Resource not accessible by integration"),
    );
    expect((await put()).status).toBe(403);
  });

  it("lists reviewer candidates and requests reviewers as the user", async () => {
    await connected();
    gh.listAssignees.mockResolvedValue([
      { login: "cy", avatar_url: "c", id: 1 },
    ]);
    expect(await (await app.request(`${P}/reviewers`)).json()).toEqual([
      { login: "cy", avatarUrl: "c" },
    ]);
    expect(gh.listAssignees).toHaveBeenCalledWith("gho_access", "acme", "web");

    gh.requestReviewers.mockResolvedValue({ number: 7 });
    const post = (body: object) =>
      app.request(`${P}/reviewers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await post({ reviewers: [] })).status).toBe(400);
    expect((await post({ reviewers: ["../x"] })).status).toBe(400);
    expect(gh.requestReviewers).not.toHaveBeenCalled();
    expect((await post({ reviewers: ["cy", "di"] })).status).toBe(200);
    expect(gh.requestReviewers).toHaveBeenCalledWith(
      "gho_access",
      "acme",
      "web",
      "7",
      ["cy", "di"],
    );
  });

  it("marks a draft ready for review through its GraphQL node id and maps a refusal", async () => {
    await connected();
    gh.getPull.mockResolvedValue({ ...pull, draft: true });
    gh.markReadyForReview.mockResolvedValueOnce(undefined);
    const post = () => app.request(`${P}/ready`, { method: "POST" });
    expect((await post()).status).toBe(200);
    expect(gh.markReadyForReview).toHaveBeenLastCalledWith(
      "gho_access",
      "PR_node7",
    );

    const { GithubApiError } = await vi.importActual<
      typeof import("../../apps/api/src/github-reviews/github-api")
    >("../../apps/api/src/github-reviews/github-api");
    gh.markReadyForReview.mockRejectedValueOnce(
      new GithubApiError(403, "Resource not accessible by integration"),
    );
    expect((await post()).status).toBe(403);
  });

  it("links a task to the pull request, shows it as the issue and unlinks it", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    await connectFlow(member.user.id);
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Ship it", number: 1 })
      .returning();
    gh.getPull.mockResolvedValue(pull);
    const detail = async () => (await (await app.request(P)).json()).issue;
    expect(await detail()).toBeNull();

    const created = await app.request(`/api/external-link/task/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: pull.html_url,
        resourceType: "pull_request",
        metadata: { state: "open", merged: false, draft: false },
      }),
    });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    expect(await detail()).toMatchObject({
      taskId: task.id,
      workspaceId: member.workspace.id,
      linkId: id,
      manual: true,
      title: "Ship it",
    });

    // A user outside the workspace can neither link nor unlink.
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const refused = await app.request(`/api/external-link/task/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://github.com/acme/web/pull/8",
        resourceType: "pull_request",
      }),
    });
    expect([403, 404]).toContain(refused.status);
    const refusedDelete = await app.request(
      `/api/external-link/task/${task.id}/${id}`,
      { method: "DELETE" },
    );
    expect([403, 404]).toContain(refusedDelete.status);
    expect(await db.select().from(schema.externalLinkTable)).toHaveLength(1);

    mockAuthenticatedSession(member.user);
    const removed = await app.request(
      `/api/external-link/task/${task.id}/${id}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
    expect(await detail()).toBeNull();
  });

  it("refuses another user who has not connected", async () => {
    await connected();
    await signedInUser();
    expect((await app.request(P)).status).toBe(409);
    expect(gh.getPull).not.toHaveBeenCalled();
  });

  it("rejects path values that could escape the repo path", async () => {
    await connected();
    expect((await app.request(`${BASE}/pulls/acme/web/7x`)).status).toBe(400);
  });
});
