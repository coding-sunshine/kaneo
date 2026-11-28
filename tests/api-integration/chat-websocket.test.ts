import { once } from "node:events";
import type { IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import type { Session, User } from "better-auth/types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import type { NodeWebSocket } from "../../apps/api/node_modules/@hono/node-ws";
import { sql } from "drizzle-orm";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import {
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

type Socket = NodeWebSocket["wss"]["clients"] extends Set<infer S> ? S : never;
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const nodeWsRequire = createRequire(apiRequire.resolve("@hono/node-ws"));
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = nodeWsRequire("ws").WebSocket;

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

let server: ReturnType<typeof serve>;
let base: string;
const sockets: Socket[] = [];
const users = new Map<string, User>();

const tokenFor = (member: Seeded) => `Bearer chat-ws-${member.user.id}`;

function session(user: User): { session: Session; user: User } {
  const now = new Date();
  return {
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    user,
  };
}

async function request(
  member: Seeded,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(`http://${base}/api${path}`, {
    method,
    headers: {
      authorization: tokenFor(member),
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

/** Opens a chat socket (or the user socket) and collects what it receives. */
async function subscribe(member: Seeded, channelId: string, path = "chat/") {
  const socket = new WebSocket(`ws://${base}/api/ws/${path}${channelId}`, {
    headers: { authorization: tokenFor(member) },
  });
  sockets.push(socket);
  const received: unknown[] = [];
  socket.on("error", () => {});
  socket.on("message", (data: Buffer) =>
    received.push(JSON.parse(data.toString())),
  );
  const status = await new Promise<number>((resolve) => {
    socket.once("open", () => resolve(101));
    socket.once(
      "unexpected-response",
      (_request: unknown, response: IncomingMessage) => {
        response.resume();
        resolve(response.statusCode ?? 0);
        socket.terminate();
      },
    );
  });
  return { socket, status, received };
}

async function addToWorkspace(
  workspaceId: string,
  member: Seeded,
  role = "member",
) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: member.user.id,
    role,
    joinedAt: new Date(),
  });
}

async function setup() {
  const a = await createWorkspaceMember({ role: "owner" });
  const b = await createWorkspaceMember();
  const c = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const workspaceId = a.workspace.id;
  await addToWorkspace(workspaceId, b);
  await addToWorkspace(workspaceId, c);
  for (const member of [a, b, c, outsider])
    users.set(tokenFor(member), member.user);

  const channels = `/chat/workspace/${workspaceId}/channels`;
  const pub = (await request(a, channels, { name: "general" })).json;
  const priv = (await request(a, channels, { name: "leads", isPrivate: true }))
    .json;
  expect(
    (await request(a, `${channels}/${priv.id}/members`, { userId: b.user.id }))
      .status,
  ).toBe(200);
  const post = async (channelId: string, text: string, as = a) => {
    const result = await request(as, `${channels}/${channelId}/messages`, {
      body: text,
    });
    await settleEvents();
    return result;
  };
  return { a, b, c, outsider, workspaceId, channels, pub, priv, post };
}

const created = (channelId: string) => ({
  type: "CHAT_MESSAGE_CREATED",
  channelId,
});

beforeEach(async () => {
  await resetTestDatabase();
  users.clear();
  vi.spyOn(auth.api, "getSession").mockImplementation((async ({
    headers,
  }: {
    headers: Headers;
  }) => {
    const user = users.get(new Headers(headers).get("authorization") ?? "");
    return user ? session(user) : null;
  }) as never);
  const app = createApp();
  server = serve({ fetch: app.app.fetch, hostname: "127.0.0.1", port: 0 });
  app.injectWebSocket(server);
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  base = `127.0.0.1:${address.port}`;
  delete process.env.REDIS_URL;
  await initializeWebSocketAdapter();
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await shutdownWebSocketAdapter();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("API integration: chat over WebSocket", () => {
  it("pushes a new message to another reader of the channel without its body", async () => {
    const { b, pub, post } = await setup();
    const reader = await subscribe(b, pub.id);
    expect(reader.status).toBe(101);

    expect((await post(pub.id, "first")).status).toBe(200);

    await vi.waitFor(() => expect(reader.received).toEqual([created(pub.id)]));
  });

  it("lets a private channel's members subscribe and refuses everyone else alike", async () => {
    const { b, c, outsider, priv, post } = await setup();
    const member = await subscribe(b, priv.id);
    const nonMember = await subscribe(c, priv.id);
    const otherWorkspace = await subscribe(outsider, priv.id);
    const missing = await subscribe(c, "no-such-channel");

    expect(member.status).toBe(101);
    expect(nonMember.status).toBe(404);
    expect(otherWorkspace.status).toBe(404);
    expect(missing.status).toBe(404);

    await post(priv.id, "secret");
    await vi.waitFor(() => expect(member.received).toHaveLength(1));
    expect(nonMember.received).toEqual([]);
  });

  it("refuses a socket with no session", async () => {
    const { pub } = await setup();
    const anonymous = await subscribe(
      { user: { id: "nobody" } } as Seeded,
      pub.id,
    );
    expect(anonymous.status).toBe(401);
  });

  it("refuses a user from another workspace on a public channel", async () => {
    const { outsider, pub } = await setup();
    expect((await subscribe(outsider, pub.id)).status).toBe(404);
  });

  it("stops delivering to a member who left a private channel", async () => {
    const { b, channels, priv, post } = await setup();
    const reader = await subscribe(b, priv.id);
    expect(reader.status).toBe(101);

    expect((await request(b, `${channels}/${priv.id}/leave`, {})).status).toBe(
      200,
    );
    await post(priv.id, "after leaving");

    await vi.waitFor(() =>
      expect(reader.socket.readyState).toBe(reader.socket.CLOSED),
    );
    expect(reader.received).toEqual([]);
  });

  it("tells another reader when a message is edited, pinned or deleted", async () => {
    const { a, b, channels, pub, post } = await setup();
    const message = (await post(pub.id, "draft")).json;
    const reader = await subscribe(b, pub.id);
    expect(reader.status).toBe(101);
    const url = `${channels}/${pub.id}/messages/${message.id}`;
    const changed = { type: "CHAT_MESSAGE_UPDATED", channelId: pub.id };

    expect((await request(a, url, { body: "final" }, "PATCH")).status).toBe(
      200,
    );
    await settleEvents();
    expect((await request(a, `${url}/pin`, {})).status).toBe(200);
    await settleEvents();
    expect((await request(a, url, undefined, "DELETE")).status).toBe(200);
    await settleEvents();

    await vi.waitFor(() =>
      expect(reader.received).toEqual([changed, changed, changed]),
    );
  });

  it("hints unread changes only to the channel's other members", async () => {
    const { a, b, c, workspaceId, priv, post } = await setup();
    const userSocket = (member: Seeded) => subscribe(member, "user", "");
    const [forA, forB, forC] = await Promise.all([a, b, c].map(userSocket));
    for (const socket of [forA, forB, forC]) expect(socket.status).toBe(101);
    const hint = { type: "CHAT_UNREAD_CHANGED", workspaceId };
    const hints = (socket: { received: unknown[] }) =>
      socket.received.filter(
        (message) => (message as { type?: string }).type === hint.type,
      );

    await post(priv.id, "for leads");
    await vi.waitFor(() => expect(hints(forB)).toEqual([hint]));
    expect(hints(forA)).toEqual([]);
    expect(hints(forC)).toEqual([]);
    expect(JSON.stringify(forB.received)).not.toContain(priv.id);
  });

  it("tells nobody else when a member reads a channel", async () => {
    const { a, b, channels, pub, post } = await setup();
    await request(b, `${channels}/${pub.id}/join`, {});
    await post(pub.id, "hello");
    const reader = await subscribe(a, pub.id);
    const aUser = await subscribe(a, "user", "");

    expect((await request(b, `${channels}/${pub.id}/read`, {})).status).toBe(
      200,
    );
    await settleEvents();
    await post(pub.id, "marker");
    await vi.waitFor(() => expect(reader.received).toEqual([created(pub.id)]));
    expect(
      aUser.received.filter(
        (message) =>
          (message as { type?: string }).type === "CHAT_UNREAD_CHANGED",
      ),
    ).toEqual([]);
  });

  it("serves chat and delivers messages without Redis", async () => {
    const { b, pub, post } = await setup();
    expect(process.env.REDIS_URL).toBeUndefined();
    const reader = await subscribe(b, pub.id);

    expect((await post(pub.id, "one")).status).toBe(200);
    expect((await post(pub.id, "two")).status).toBe(200);

    await vi.waitFor(() => expect(reader.received).toHaveLength(2));
  });
});

describe("API integration: typing over the chat socket", () => {
  const typing = (channelId: string, userId: string, on: boolean) => ({
    type: "CHAT_TYPING",
    channelId,
    userId,
    typing: on,
  });
  const typingIn = (socket: { received: unknown[] }) =>
    socket.received.filter(
      (message) => (message as { type?: string }).type === "CHAT_TYPING",
    );
  const sendTyping = (
    member: Seeded,
    channels: string,
    channelId: string,
    on = true,
  ) => request(member, `${channels}/${channelId}/typing`, { typing: on });

  async function countRows() {
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    const counts: Record<string, number> = {};
    for (const { table_name } of tables.rows) {
      const result = await db.execute<{ count: number }>(
        sql`select count(*)::int as count from ${sql.identifier(table_name)}`,
      );
      counts[table_name] = result.rows[0]?.count ?? 0;
    }
    return counts;
  }

  it("tells another reader with the channel open when a member starts and stops typing", async () => {
    const { a, b, channels, pub } = await setup();
    const reader = await subscribe(b, pub.id);
    expect(reader.status).toBe(101);

    expect((await sendTyping(a, channels, pub.id)).status).toBe(200);
    await vi.waitFor(() =>
      expect(typingIn(reader)).toEqual([typing(pub.id, a.user.id, true)]),
    );
    expect((await sendTyping(a, channels, pub.id, false)).status).toBe(200);
    await vi.waitFor(() =>
      expect(typingIn(reader)).toEqual([
        typing(pub.id, a.user.id, true),
        typing(pub.id, a.user.id, false),
      ]),
    );
  });

  it("sends nothing to a user who does not have the channel open", async () => {
    const { a, b, channels, pub, post } = await setup();
    const userSocket = await subscribe(b, "user", "");
    const marker = await subscribe(b, pub.id);

    await sendTyping(a, channels, pub.id);
    await post(pub.id, "marker");
    await vi.waitFor(() =>
      expect(marker.received).toContainEqual(created(pub.id)),
    );
    expect(typingIn(userSocket)).toEqual([]);
  });

  it("never delivers typing in a private channel to a non-member", async () => {
    const { a, b, c, channels, priv, pub, post } = await setup();
    const member = await subscribe(b, priv.id);
    const nonMember = await subscribe(c, priv.id);
    const elsewhere = await subscribe(c, pub.id);
    const userSocket = await subscribe(c, "user", "");
    expect(member.status).toBe(101);
    expect(nonMember.status).toBe(404);

    expect((await sendTyping(a, channels, priv.id)).status).toBe(200);
    await vi.waitFor(() =>
      expect(typingIn(member)).toEqual([typing(priv.id, a.user.id, true)]),
    );
    await post(pub.id, "marker");
    await vi.waitFor(() =>
      expect(elsewhere.received).toContainEqual(created(pub.id)),
    );
    for (const socket of [nonMember, elsewhere, userSocket])
      expect(JSON.stringify(socket.received)).not.toContain(priv.id);
  });

  it("stops typing reaching a member who left a private channel", async () => {
    const { a, b, channels, priv } = await setup();
    const reader = await subscribe(b, priv.id);
    expect((await request(b, `${channels}/${priv.id}/leave`, {})).status).toBe(
      200,
    );

    await sendTyping(a, channels, priv.id);
    await vi.waitFor(() =>
      expect(reader.socket.readyState).toBe(reader.socket.CLOSED),
    );
    expect(typingIn(reader)).toEqual([]);
  });

  it("lets only members who may post send typing", async () => {
    const { a, b, c, outsider, workspaceId, channels, pub, priv } =
      await setup();
    const viewer = await createWorkspaceMember();
    await addToWorkspace(workspaceId, viewer, "viewer");
    users.set(tokenFor(viewer), viewer.user);
    const reader = await subscribe(a, pub.id);
    const privReader = await subscribe(a, priv.id);

    expect((await sendTyping(c, channels, priv.id)).status).toBe(404);
    expect((await sendTyping(outsider, channels, pub.id)).status).toBe(404);
    expect((await sendTyping(b, channels, pub.id)).status).toBe(403);
    expect((await sendTyping(viewer, channels, pub.id)).status).toBe(403);

    expect(
      (await request(a, `${channels}/${pub.id}`, { archived: true }, "PATCH"))
        .status,
    ).toBe(200);
    expect((await sendTyping(a, channels, pub.id)).status).toBe(409);

    await settleEvents();
    expect(typingIn(reader)).toEqual([]);
    expect(typingIn(privReader)).toEqual([]);
  });

  it("stores no typing in the database", async () => {
    const { a, b, channels, pub } = await setup();
    const reader = await subscribe(b, pub.id);
    await settleEvents();
    const before = await countRows();

    await sendTyping(a, channels, pub.id);
    await sendTyping(a, channels, pub.id, false);
    await vi.waitFor(() => expect(typingIn(reader)).toHaveLength(2));
    await settleEvents();

    expect(await countRows()).toEqual(before);
  });

  it("answers 429 to more than one start, or one stop, per second in a channel", async () => {
    const { a, b, channels, pub } = await setup();
    const reader = await subscribe(b, pub.id);

    expect((await sendTyping(a, channels, pub.id)).status).toBe(200);
    expect((await sendTyping(a, channels, pub.id)).status).toBe(429);
    // A stop right after a start still goes through, once.
    expect((await sendTyping(a, channels, pub.id, false)).status).toBe(200);
    expect((await sendTyping(a, channels, pub.id, false)).status).toBe(429);

    await vi.waitFor(() => expect(typingIn(reader)).toHaveLength(2));
    expect(typingIn(reader)).toEqual([
      typing(pub.id, a.user.id, true),
      typing(pub.id, a.user.id, false),
    ]);
  });
});
