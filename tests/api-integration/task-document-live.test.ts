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
import { auth } from "../../apps/api/src/auth";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import {
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
} from "./helpers/document-access/build-document-world";

type Socket = NodeWebSocket["wss"]["clients"] extends Set<infer S> ? S : never;
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const nodeWsRequire = createRequire(apiRequire.resolve("@hono/node-ws"));
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = nodeWsRequire("ws").WebSocket;

type Message = { type?: string; [key: string]: unknown };

let server: ReturnType<typeof serve>;
let base: string;
const sockets: Socket[] = [];
const users = new Map<string, User>();
const tokenFor = (user: User) => `Bearer links-ws-${user.id}`;

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
  user: User,
  path: string,
  method: string,
  body: unknown,
) {
  const response = await fetch(`http://${base}/api${path}`, {
    method,
    headers: {
      authorization: tokenFor(user),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  await settleEvents();
}

/** Opens the user socket, or a project socket, and keeps what it receives. */
async function listen(user: User, path = "user") {
  const socket = new WebSocket(`ws://${base}/api/ws/${path}`, {
    headers: { authorization: tokenFor(user) },
  });
  sockets.push(socket);
  const received: Message[] = [];
  socket.on("error", () => {});
  socket.on("message", (data: Buffer) =>
    received.push(JSON.parse(data.toString())),
  );
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once(
      "unexpected-response",
      (_request: unknown, response: IncomingMessage) =>
        reject(new Error(`socket refused: ${response.statusCode}`)),
    );
  });
  return received;
}

const of = (received: Message[], type: string) =>
  received.filter((message) => message.type === type);

const documentAddress = (world: DocumentWorld, id: string) =>
  `https://tracker.example/dashboard/workspace/${world.ws}/document/${id}`;
const linkTo = (world: DocumentWorld, id: string) =>
  `<p>See <a href="${documentAddress(world, id)}">the plan</a>.</p>`;

async function setup() {
  const world = await buildDocumentWorld();
  for (const user of [world.owner, world.limited, world.open])
    users.set(tokenFor(user), user);
  vi.spyOn(auth.api, "getSession").mockImplementation((async ({
    headers,
  }: {
    headers: Headers;
  }) => {
    const user = users.get(new Headers(headers).get("authorization") ?? "");
    return user ? session(user) : null;
  }) as never);
  const describeTask = (user: User, description: string) =>
    request(user, `/task/description/${world.alphaTask.id}`, "PUT", {
      description,
    });
  return { world, describeTask };
}

beforeEach(async () => {
  await resetTestDatabase();
  users.clear();
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
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("API integration: live links between issues and documents", () => {
  it("tells the document's readers, and only them, when an issue gains or drops a link", async () => {
    const { world, describeTask } = await setup();
    const { owner, limited, open, docs } = world;
    const [forOwner, forLimited, forOpen] = await Promise.all(
      [owner, limited, open].map((user) => listen(user)),
    );
    const hint = {
      type: "DOCUMENT_LINKS_CHANGED",
      workspaceId: world.ws,
      documentId: docs.teamBeta,
    };

    // `limited` cannot open team Beta's document; the saver gets the hint too.
    await describeTask(owner, linkTo(world, docs.teamBeta));
    await vi.waitFor(() => expect(of(forOpen, hint.type)).toEqual([hint]));
    expect(of(forOwner, hint.type)).toEqual([hint]);
    expect(of(forLimited, hint.type)).toEqual([]);
    // The hint names the document only: nothing about the issue.
    expect(JSON.stringify(forOpen)).not.toContain(world.alphaTask.id);
    expect(JSON.stringify(forOpen)).not.toContain("Alpha issue");

    // Saving the same link again changes no link and sends nothing.
    await describeTask(owner, `${linkTo(world, docs.teamBeta)}<p>.</p>`);
    expect(of(forOpen, hint.type)).toEqual([hint]);

    // Dropping the link is a change too.
    await describeTask(owner, "<p>No links.</p>");
    await vi.waitFor(() =>
      expect(of(forOpen, hint.type)).toEqual([hint, hint]),
    );
    expect(of(forLimited, hint.type)).toEqual([]);
  });

  it("tells a document's readers about an issue created with a link to it", async () => {
    const { world } = await setup();
    const forOpen = await listen(world.open);

    await request(world.owner, `/task/${world.alpha.id}`, "POST", {
      title: "Follow up",
      description: linkTo(world, world.docs.teamAlpha),
      status: "to-do",
      priority: "low",
    });

    await vi.waitFor(() =>
      expect(of(forOpen, "DOCUMENT_LINKS_CHANGED")).toEqual([
        {
          type: "DOCUMENT_LINKS_CHANGED",
          workspaceId: world.ws,
          documentId: world.docs.teamAlpha,
        },
      ]),
    );
  });

  it("tells an issue's team when a document's text starts naming the issue", async () => {
    const { world } = await setup();
    const { owner, limited, alphaTask, alpha, beta } = world;
    const forAlpha = await listen(limited, alpha.id);
    const forBeta = await listen(owner, beta.id);
    const address = `https://tracker.example/dashboard/workspace/${world.ws}/project/${alpha.id}/task/${alphaTask.id}`;

    await request(
      owner,
      `/document/workspace/${world.ws}/${world.docs.private}`,
      "PATCH",
      { content: `<p>Tracks <a href="${address}">the issue</a>.</p>` },
    );

    const hint = {
      type: "TASK_DOCUMENTS_UPDATED",
      projectId: alpha.id,
      taskId: alphaTask.id,
    };
    await vi.waitFor(() => expect(of(forAlpha, hint.type)).toEqual([hint]));
    // A private document's id never reaches the issue's team.
    expect(JSON.stringify(forAlpha)).not.toContain(world.docs.private);
    expect(of(forBeta, hint.type)).toEqual([]);
  });
});
