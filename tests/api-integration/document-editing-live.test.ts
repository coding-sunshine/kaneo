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
import { createWorkspaceMember } from "./helpers/fixtures";
import * as Y from "../../apps/api/node_modules/yjs";
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
const tokenFor = (user: User) => `Bearer editing-ws-${user.id}`;

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

async function announce(user: User, world: DocumentWorld, id: string) {
  const response = await fetch(
    `http://${base}/api/document/workspace/${world.ws}/${id}/editing`,
    { method: "POST", headers: { authorization: tokenFor(user) } },
  );
  await settleEvents();
  return response.status;
}

async function setup() {
  const world = await buildDocumentWorld();
  const { user: outsider } = await createWorkspaceMember({ role: "owner" });
  for (const user of [world.owner, world.limited, world.open, outsider])
    users.set(tokenFor(user), user);
  vi.spyOn(auth.api, "getSession").mockImplementation((async ({
    headers,
  }: {
    headers: Headers;
  }) => {
    const user = users.get(new Headers(headers).get("authorization") ?? "");
    return user ? session(user) : null;
  }) as never);
  return { world, outsider };
}

const EDITING = "DOCUMENT_EDITING";

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

describe("API integration: who is editing a document", () => {
  it("tells the document's other readers, by name, and not the editor", async () => {
    const { world } = await setup();
    const { owner, open, limited, docs } = world;
    const [forOwner, forOpen, forLimited] = await Promise.all(
      [owner, open, limited].map((user) => listen(user)),
    );

    expect(await announce(owner, world, docs.workspace)).toBe(200);
    const hint = {
      type: EDITING,
      workspaceId: world.ws,
      documentId: docs.workspace,
      userId: owner.id,
      name: owner.name,
    };
    await vi.waitFor(() => expect(of(forOpen, EDITING)).toEqual([hint]));
    await vi.waitFor(() => expect(of(forLimited, EDITING)).toEqual([hint]));
    expect(of(forOwner, EDITING)).toEqual([]);
  });

  it("says nothing to a member who cannot open the document", async () => {
    const { world } = await setup();
    const { owner, open, limited, docs } = world;
    const [forOpen, forLimited] = await Promise.all(
      [open, limited].map((user) => listen(user)),
    );

    expect(await announce(owner, world, docs.teamBeta)).toBe(200);
    await vi.waitFor(() => expect(of(forOpen, EDITING)).toHaveLength(1));
    expect(of(forLimited, EDITING)).toEqual([]);
    expect(JSON.stringify(forLimited)).not.toContain(docs.teamBeta);
  });

  it("refuses a reader who may only view, and sends nothing", async () => {
    const { world } = await setup();
    const forOwner = await listen(world.owner);

    expect(await announce(world.limited, world, world.docs.sharedByName)).toBe(
      403,
    );
    expect(await announce(world.limited, world, world.docs.teamBeta)).toBe(404);
    expect(of(forOwner, EDITING)).toEqual([]);
  });

  it("refuses somebody outside the workspace", async () => {
    const { world, outsider } = await setup();
    const forOwner = await listen(world.owner);

    expect(await announce(outsider, world, world.docs.workspace)).not.toBe(200);
    expect(of(forOwner, EDITING)).toEqual([]);
  });

  it("sends one hint for a burst of keystrokes", async () => {
    const { world } = await setup();
    const forOpen = await listen(world.open);

    for (let i = 0; i < 3; i += 1)
      expect(await announce(world.owner, world, world.docs.workspace)).toBe(
        200,
      );
    await vi.waitFor(() => expect(of(forOpen, EDITING)).toHaveLength(1));
  });
  it("passes co-editing changes and cursors only to the document's readers", async () => {
    vi.stubEnv("DOCUMENT_COEDITING_KEY", "approved-for-tests");
    const { world } = await setup();
    const { owner, open, limited, docs } = world;
    const path = `http://${base}/api/document/workspace/${world.ws}/${docs.teamBeta}/collab`;
    const post = async (user: User, route: string, body: unknown) => {
      const response = await fetch(`${path}${route}`, {
        method: "POST",
        headers: {
          authorization: tokenFor(user),
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      await settleEvents();
      return response.status;
    };
    const state = (await (
      await fetch(path, { headers: { authorization: tokenFor(owner) } })
    ).json()) as { contentHash: string };
    const doc = new Y.Doc();
    doc.getText("t").insert(0, "seed");
    const update = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
    expect(
      await post(owner, "/seed", { update, baseHash: state.contentHash }),
    ).toBe(200);

    const [forOwner, forOpen, forLimited] = await Promise.all(
      [owner, open, limited].map((user) => listen(user)),
    );
    expect(await post(owner, "/update", { update })).toBe(200);
    expect(await post(owner, "/awareness", { update: "AA==" })).toBe(200);

    await vi.waitFor(() =>
      expect(of(forOpen, "DOCUMENT_COLLAB_AWARENESS")).toHaveLength(1),
    );
    expect(of(forOpen, "DOCUMENT_COLLAB_UPDATE")).toEqual([
      {
        type: "DOCUMENT_COLLAB_UPDATE",
        workspaceId: world.ws,
        documentId: docs.teamBeta,
        update,
      },
    ]);
    // The sender's other tabs get the change, not their own cursor.
    expect(of(forOwner, "DOCUMENT_COLLAB_UPDATE")).toHaveLength(1);
    expect(of(forOwner, "DOCUMENT_COLLAB_AWARENESS")).toEqual([]);
    expect(forLimited.filter((m) => m.type?.startsWith("DOCUMENT_"))).toEqual(
      [],
    );
    vi.unstubAllEnvs();
  });
});
