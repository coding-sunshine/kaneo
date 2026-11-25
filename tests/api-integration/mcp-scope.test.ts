import { createHmac, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  createAuthorizationRequest,
  getAuthorizationRequest,
  registerClient,
} from "../../apps/api/src/mcp/oauth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";

const redirectUri = "https://client.example/callback";
const verifier = "mcp-scope-test-verifier";
const origin = "http://localhost:5173";

type App = ReturnType<typeof createApp>["app"];
type User = Awaited<ReturnType<typeof signUpWithSession>>;
type Token = { access_token: string; scope?: string };

beforeEach(resetTestDatabase);

async function authorize(
  app: App,
  headers: Record<string, string>,
  access?: unknown,
) {
  const client = await registerClient({ redirectUris: [redirectUri] });
  const requestId = await createAuthorizationRequest({
    clientId: client.clientId,
    redirectUri,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  const body =
    access === undefined ? { approved: true } : { approved: true, access };
  const decision = await app.request(
    `/api/mcp/authorize/request/${requestId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", origin, ...headers },
      body: JSON.stringify(body),
    },
  );
  return { client, requestId, decision };
}

// Consent, then redeem the code. Everything goes through the full app.
async function connect(app: App, user: User, access?: unknown) {
  const { client, decision } = await authorize(
    app,
    { cookie: user.cookies },
    access,
  );
  expect(decision.status).toBe(200);
  const { redirect } = (await decision.json()) as { redirect: string };
  const code = new URL(redirect).searchParams.get("code");
  expect(code).toBeTruthy();
  const response = await app.request("/api/mcp/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      client_id: client.clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Token;
}

async function world() {
  const { app } = createApp();
  const user = await signUpWithSession(app, {
    email: "scope-user@example.com",
    name: "Scope User",
  });
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: "ws-scope",
      name: "Scope WS",
      slug: "scope-ws",
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: user.userId,
    role: "owner",
    joinedAt: new Date(),
  });
  const team = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "scope-a",
  });
  const doomed = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "scope-b",
  });
  const task = await createTaskFixture(team, "Seed issue", user.userId);
  const docs = await connect(app, user, "documents");
  const full = await connect(app, user, "full");
  return {
    app,
    user,
    ws: workspace.id,
    team: team.project.id,
    doomed: doomed.project.id,
    task: task.id,
    docs,
    full,
  };
}
type World = Awaited<ReturnType<typeof world>>;

const bearer = (t: Token) => ({ authorization: `Bearer ${t.access_token}` });
const send = (
  w: World,
  who: Token,
  method: string,
  path: string,
  body?: unknown,
) =>
  w.app.request(`/api${path}`, {
    method,
    headers: {
      ...bearer(who),
      origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const scopeOf = async (t: Token) => {
  const [row] = await db
    .select()
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.token, t.access_token));
  return row.mcpScope;
};

// The same token as the browser would hold it: signed, in the session cookie.
async function signedCookie(token: Token) {
  const context = await auth.$context;
  const mac = createHmac("sha256", context.secret)
    .update(token.access_token)
    .digest("base64");
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token.access_token}.${mac}`)}`;
}

const newIssue = (w: World) =>
  [
    "POST",
    `/task/${w.team}`,
    { title: "Scoped", description: "d", priority: "low", status: "to-do" },
  ] as const;

// Writes a documents token must not make. Each also works with a full token.
const refused: [string, (w: World) => readonly [string, string, unknown?]][] = [
  ["create issue", newIssue],
  [
    "create team",
    (w) => [
      "POST",
      "/project",
      { name: "T", workspaceId: w.ws, icon: "Folder", slug: "scope-new" },
    ],
  ],
  [
    "update team",
    (w) => [
      "PUT",
      `/project/${w.team}`,
      {
        name: "Renamed",
        icon: "Folder",
        slug: "scope-a",
        description: "d",
        isPublic: false,
      },
    ],
  ],
  ["delete team", (w) => ["DELETE", `/project/${w.doomed}`]],
  [
    "create label",
    (w) => [
      "POST",
      "/label",
      { name: "L", color: "#ff0000", workspaceId: w.ws },
    ],
  ],
  [
    "create comment",
    (w) => ["POST", `/comment/${w.task}`, { content: "hello" }],
  ],
  [
    "invite member",
    (w) => [
      "POST",
      "/auth/organization/invite-member",
      { email: "invitee@example.com", role: "member", organizationId: w.ws },
    ],
  ],
  ["create api key", () => ["POST", "/auth/api-key/create", { name: "k" }]],
  ["list sessions", () => ["GET", "/auth/list-sessions"]],
  [
    "approve device",
    () => ["POST", "/auth/device/approve", { userCode: "ABCD1234" }],
  ],
  ["device page", () => ["GET", "/auth/device?user_code=ABCD1234"]],
  [
    "change password",
    () => [
      "POST",
      "/auth/change-password",
      {
        currentPassword: "correct horse battery staple",
        newPassword: "another long passphrase 42",
      },
    ],
  ],
  ["revoke other sessions", () => ["POST", "/auth/revoke-other-sessions", {}]],
  // Reads that write or hand out a credential.
  [
    "start a GitHub reviews connection",
    () => ["GET", "/github-reviews/connect"],
  ],
  ["read the identity provider token", () => ["GET", "/oauth/id-token"]],
  ["list cycles", (w) => ["GET", `/cycle/project/${w.team}`]],
  ["read billing", (w) => ["GET", `/billing/${w.ws}`]],
  ["list own sessions", () => ["GET", "/user/sessions"]],
  [
    "prefix-only /documentx",
    (w) => ["POST", "/documentx", { workspaceId: w.ws, title: "x" }],
  ],
  [
    "prefix-only /topics-evil",
    (w) => ["POST", "/topics-evil", { workspaceId: w.ws, name: "x" }],
  ],
];

describe("MCP token scope", () => {
  it("issues a documents token with scope docs:write", async () => {
    const w = await world();
    expect(w.docs.scope).toBe("docs:write");
    expect(await scopeOf(w.docs)).toBe("docs:write");
  });

  it("keeps full and unspecified tokens unscoped and working", async () => {
    const w = await world();
    const unspecified = await connect(w.app, w.user);
    for (const token of [w.full, unspecified]) {
      expect(token).not.toHaveProperty("scope");
      expect(await scopeOf(token)).toBeNull();
      const [method, path, body] = newIssue(w);
      expect((await send(w, token, method, path, body)).status).toBe(200);
    }
  });

  it("rejects an unknown access value with 400", async () => {
    const { app } = createApp();
    const user = await signUpWithSession(app, {
      email: "bad-access@example.com",
      name: "Bad Access",
    });
    const { decision } = await authorize(
      app,
      { cookie: user.cookies },
      "admin",
    );
    expect(decision.status).toBe(400);
  });

  it("lets a documents token read", async () => {
    const w = await world();
    for (const path of [
      "/workspace",
      "/auth/get-session",
      "/auth/organization/list",
      `/project?workspaceId=${w.ws}`,
      // Every read the assistant tools make.
      `/project/${w.team}`,
      `/task/tasks/${w.team}`,
      `/task/${w.task}`,
      `/activity/${w.task}`,
      `/comment/${w.task}`,
      `/column/${w.team}`,
      `/custom-field/project/${w.team}`,
      `/custom-field/task/${w.task}`,
      `/label/workspace/${w.ws}`,
      "/notification",
      `/search?q=seed&workspaceId=${w.ws}`,
      `/task-relation/${w.task}`,
      `/time-entry/task/${w.task}`,
      "/user/me",
      `/workspace/${w.ws}/members`,
      `/document/workspace/${w.ws}`,
      `/topic/workspace/${w.ws}`,
    ]) {
      expect({
        path,
        status: (await send(w, w.docs, "GET", path)).status,
      }).toEqual({ path, status: 200 });
    }
  });

  it("lets a documents token write documents and topics", async () => {
    const w = await world();
    const doc = await send(w, w.docs, "POST", "/document", {
      workspaceId: w.ws,
      title: "Doc",
      content: "<p>x</p>",
    });
    expect(doc.status).toBe(200);
    const topic = await send(w, w.docs, "POST", "/topic", {
      workspaceId: w.ws,
      name: "Topic",
    });
    expect(topic.status).toBe(200);

    // The slots of a topic and the statements of a document are part of both.
    const { id: docId } = (await doc.json()) as { id: string };
    const { id: topicId } = (await topic.json()) as { id: string };
    const steps: [string, string, unknown?][] = [
      [
        "POST",
        `/topic/workspace/${w.ws}/${topicId}/slots`,
        { name: "Code", type: "term" },
      ],
      ["GET", `/topic/workspace/${w.ws}/${topicId}/slots`],
      ["PUT", `/topic/workspace/${w.ws}/${topicId}/document/${docId}`],
      [
        "POST",
        `/document/workspace/${w.ws}/${docId}/statements`,
        { slot: "code", value: "x", quote: "x" },
      ],
      ["GET", `/document/workspace/${w.ws}/${docId}/statements`],
      ["GET", `/document/workspace/${w.ws}/${docId}/receipt`],
    ];
    for (const [method, path, body] of steps) {
      expect({
        path,
        status: (await send(w, w.docs, method, path, body)).status,
      }).toEqual({ path, status: 200 });
    }
    // Settling a conflict is let through too: the answer is about the
    // conflict, not about the connection.
    const settled = await send(
      w,
      w.docs,
      "POST",
      `/document/workspace/${w.ws}/${docId}/conflicts/no-such-conflict/decide`,
      { decision: "keep", reason: "No." },
    );
    expect(settled.status).toBe(404);
  });

  it("lets a documents token reach the ripple flag routes", async () => {
    const w = await world();
    const calls: [string, string, unknown?][] = [
      [
        "PUT",
        `/document/workspace/${w.ws}/d/statements/s/dependents`,
        { taskId: "x" },
      ],
      ["DELETE", `/document/workspace/${w.ws}/d/statements/s/dependents/x`],
      ["GET", `/topic/workspace/${w.ws}/needs-review`],
      ["POST", `/topic/workspace/${w.ws}/needs-review/x/clear`],
    ];
    for (const [method, path, body] of calls) {
      // The answer is about the document or the flag, not the connection.
      const { status } = await send(w, w.docs, method, path, body);
      expect({ method, path, refused: status === 403 }).toEqual({
        method,
        path,
        refused: false,
      });
    }
  });

  it.each(refused)("refuses a documents token on: %s", async (_name, build) => {
    const w = await world();
    const [method, path, body] = build(w);
    expect((await send(w, w.docs, method, path, body)).status).toBe(403);
    expect(
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.projectId, w.team)),
    ).toHaveLength(1);
  });

  it("answers a full token on the same calls (control)", async () => {
    const w = await world();
    const statuses: Record<string, number> = {};
    for (const [name, build] of refused) {
      const [method, path, body] = build(w);
      statuses[name] = (await send(w, w.full, method, path, body)).status;
    }
    expect(
      Object.entries(statuses).filter(([, status]) => status === 403),
    ).toEqual([]);
    expect(statuses["create issue"]).toBe(200);
    expect(statuses["list sessions"]).toBe(200);
    for (const name of [
      "create team",
      "update team",
      "delete team",
      "create label",
      "create comment",
    ]) {
      expect({ name, status: statuses[name] }).toEqual({ name, status: 200 });
    }
  });

  it("refuses a documents token approving a consent request", async () => {
    const w = await world();
    const { requestId, decision } = await authorize(
      w.app,
      bearer(w.docs),
      "full",
    );
    expect(decision.status).toBe(403);
    expect(await decision.text()).not.toContain("code=");
    expect(await getAuthorizationRequest(requestId)).not.toBeNull();
  });

  it("applies the scope to the signed session cookie too", async () => {
    const w = await world();
    const [, path, body] = newIssue(w);
    const viaCookie = async (token: Token) =>
      w.app.request(`/api${path}`, {
        method: "POST",
        headers: {
          cookie: await signedCookie(token),
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    expect((await viaCookie(w.full)).status).toBe(200);
    expect((await viaCookie(w.docs)).status).toBe(403);
  });

  it("refuses the cookie of a documents token on the auth routes and on consent", async () => {
    const w = await world();
    const sessions = async (token: Token) =>
      (
        await w.app.request("/api/auth/list-sessions", {
          headers: { cookie: await signedCookie(token), origin },
        })
      ).status;
    expect(await sessions(w.full)).toBe(200);
    expect(await sessions(w.docs)).toBe(403);
    const { decision } = await authorize(
      w.app,
      { cookie: await signedCookie(w.docs) },
      "full",
    );
    expect(decision.status).toBe(403);
  });

  it("refuses an auth write that carries a documents token beside a browser cookie", async () => {
    const w = await world();
    const response = await w.app.request("/api/auth/api-key/create", {
      method: "POST",
      headers: {
        ...bearer(w.docs),
        cookie: w.user.cookies,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "k" }),
    });
    expect(response.status).toBe(403);
    expect(await db.select().from(schema.apikeyTable)).toHaveLength(0);
  });

  it("lets a documents token sign out, which ends it", async () => {
    const w = await world();
    expect((await send(w, w.docs, "POST", "/auth/sign-out", {})).status).toBe(
      200,
    );
    expect((await send(w, w.docs, "GET", "/workspace")).status).toBe(401);
  });

  it("lets a documents token reach the MCP endpoint", async () => {
    const w = await world();
    const response = await w.app.request("/api/mcp", {
      method: "POST",
      headers: {
        ...bearer(w.docs),
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "scope-test", version: "1.0.0" },
        },
      }),
    });
    expect([401, 403]).not.toContain(response.status);
  });

  it("keeps the browser session unrestricted", async () => {
    const w = await world();
    const [, path, body] = newIssue(w);
    const response = await w.app.request(`/api${path}`, {
      method: "POST",
      headers: {
        cookie: w.user.cookies,
        origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
  });
});
