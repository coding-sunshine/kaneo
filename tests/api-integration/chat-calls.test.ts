import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents, subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { revokeWorkspaceConnections } from "../../apps/api/src/ws";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// A fake LiveKit deployment: the API only signs tokens with these values.
const FAKE_URL = "wss://calls.example.test";
const FAKE_KEY = "fake-livekit-key";
const FAKE_SECRET = "fake-livekit-secret-that-is-long-enough";

const rings: { callerId: string; recipientIds: string[] }[] = [];
const ringsInDirect: boolean[] = [];
subscribeToEvent<{
  callerId: string;
  recipientIds: string[];
  isDirect: boolean;
}>("chat.call_started", async (data) => {
  rings.push({ callerId: data.callerId, recipientIds: data.recipientIds });
  ringsInDirect.push(data.isDirect);
});

// A fake LiveKit room service that records what the API asks of it.
type ServiceCall = { path: string; auth: string; body: unknown };
async function startFakeLiveKit() {
  const calls: ServiceCall[] = [];
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      calls.push({
        path: req.url ?? "",
        auth: req.headers.authorization ?? "",
        body: JSON.parse(raw || "null"),
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.LIVEKIT_URL = `ws://127.0.0.1:${port}`;
  return {
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function verifiedClaims(token: string, secret: string) {
  const [header, payload, signature] = token.split(".");
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (signature !== expected) throw new Error("Bad signature");
  return JSON.parse(Buffer.from(payload ?? "", "base64url").toString());
}

// What a LiveKit server checks before letting a token join: the signature,
// then that the token is valid at that moment.
function tokenAcceptedAt(token: string, secret: string, atSeconds: number) {
  try {
    const claims = verifiedClaims(token, secret);
    return claims.nbf <= atSeconds && atSeconds < claims.exp;
  } catch {
    return false;
  }
}

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

function enableCalls() {
  process.env.LIVEKIT_URL = FAKE_URL;
  process.env.LIVEKIT_API_KEY = FAKE_KEY;
  process.env.LIVEKIT_API_SECRET = FAKE_SECRET;
}

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const teammate = await createWorkspaceMember();
  const bystander = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = owner.workspace.id;
  for (const [member, role] of [
    [teammate, "member"],
    [bystander, "member"],
    [viewer, "viewer"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role,
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  // This branch has no direct messages yet: a two-person private channel
  // stands in for one.
  const dm = await (
    await as(owner)(base, json("POST", { name: "pair", isPrivate: true }))
  ).json();
  await as(owner)(
    `${base}/${dm.id}/members`,
    json("POST", { userId: teammate.user.id }),
  );
  const pub = await (
    await as(owner)(base, json("POST", { name: "general" }))
  ).json();
  return {
    app,
    owner,
    teammate,
    bystander,
    viewer,
    outsider,
    ws,
    base,
    as,
    dm,
    pub,
  };
}

describe("API integration: chat calls", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    rings.length = 0;
    ringsInDirect.length = 0;
  });

  afterEach(() => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  });

  it("stays off without LiveKit keys and says so in the log", async () => {
    const { app, owner, base, as, dm } = await setup();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(
      (await as(owner)(`${base}/${dm.id}/call`, json("POST"))).status,
    ).toBe(404);
    expect(
      (await as(owner)(`${base}/${dm.id}/call/join`, json("POST"))).status,
    ).toBe(404);
    expect((await (await app.request("/api/config")).json()).hasCalls).toBe(
      false,
    );
    await settleEvents();
    expect(rings).toEqual([]);
    expect(info.mock.calls.map((call) => String(call[0]))).toContainEqual(
      expect.stringContaining("Calls are off"),
    );
    info.mockRestore();
  });

  it("rings the other member of a direct conversation and signs a token", async () => {
    enableCalls();
    const { app, owner, teammate, base, as, dm } = await setup();
    expect((await (await app.request("/api/config")).json()).hasCalls).toBe(
      true,
    );

    const response = await as(owner)(`${base}/${dm.id}/call`, json("POST"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(FAKE_SECRET);
    const call = JSON.parse(text);
    expect(call.serverUrl).toBe(FAKE_URL);
    const claims = verifiedClaims(call.token, FAKE_SECRET);
    expect(claims).toMatchObject({
      iss: FAKE_KEY,
      sub: owner.user.id,
      video: { room: call.roomName, roomJoin: true },
    });
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);

    await settleEvents();
    expect(rings).toEqual([
      { callerId: owner.user.id, recipientIds: [teammate.user.id] },
    ]);

    const joined = await as(teammate)(
      `${base}/${dm.id}/call/join`,
      json("POST"),
    );
    expect(joined.status).toBe(200);
    const session = await joined.json();
    expect(session.roomName).toBe(call.roomName);
    expect(verifiedClaims(session.token, FAKE_SECRET).sub).toBe(
      teammate.user.id,
    );
  });

  it("rings only channel members, never other workspace members", async () => {
    enableCalls();
    const { owner, teammate, base, as, pub } = await setup();
    await as(teammate)(`${base}/${pub.id}/join`, json("POST"));

    expect(
      (await as(owner)(`${base}/${pub.id}/call`, json("POST"))).status,
    ).toBe(200);
    await settleEvents();
    expect(rings).toEqual([
      { callerId: owner.user.id, recipientIds: [teammate.user.id] },
    ]);
  });

  it("keeps calls and tokens to channel members", async () => {
    enableCalls();
    const { bystander, viewer, outsider, base, as, dm, pub } = await setup();

    // A private channel answers like a missing one to non-members.
    expect(
      (await as(bystander)(`${base}/${dm.id}/call`, json("POST"))).status,
    ).toBe(404);
    expect(
      (await as(bystander)(`${base}/${dm.id}/call/join`, json("POST"))).status,
    ).toBe(404);
    // A public channel must be joined first.
    expect(
      (await as(bystander)(`${base}/${pub.id}/call`, json("POST"))).status,
    ).toBe(403);
    expect(
      (await as(bystander)(`${base}/${pub.id}/call/join`, json("POST"))).status,
    ).toBe(403);
    // Read-only viewers cannot call; outsiders cannot see the workspace.
    expect(
      (await as(viewer)(`${base}/${pub.id}/call`, json("POST"))).status,
    ).toBe(403);
    expect(
      (await as(outsider)(`${base}/${pub.id}/call`, json("POST"))).status,
    ).toBe(404);
    expect(
      (await as(viewer)(`${base}/${pub.id}/call/join`, json("POST"))).status,
    ).toBe(403);
    expect(
      (await as(outsider)(`${base}/${pub.id}/call/join`, json("POST"))).status,
    ).toBe(404);
    await settleEvents();
    expect(rings).toEqual([]);
  });

  it("does not start or join a call in an archived channel", async () => {
    enableCalls();
    const { owner, teammate, base, as, dm } = await setup();
    await as(owner)(`${base}/${dm.id}`, json("PATCH", { archived: true }));

    expect(
      (await as(owner)(`${base}/${dm.id}/call`, json("POST"))).status,
    ).toBe(409);
    expect(
      (await as(teammate)(`${base}/${dm.id}/call/join`, json("POST"))).status,
    ).toBe(409);
    await settleEvents();
    expect(rings).toEqual([]);
  });

  it("calls in a direct message through the same channel call routes", async () => {
    enableCalls();
    const { owner, teammate, bystander, base, as } = await setup();
    const opened = await as(owner)(
      base.replace("/channels", "/direct-messages"),
      json("POST", { userIds: [teammate.user.id] }),
    );
    expect(opened.status).toBe(200);
    const direct = await opened.json();
    expect(direct.isDirect).toBe(true);

    expect(
      (await as(owner)(`${base}/${direct.id}/call`, json("POST"))).status,
    ).toBe(200);
    await settleEvents();
    expect(rings).toEqual([
      { callerId: owner.user.id, recipientIds: [teammate.user.id] },
    ]);
    expect(ringsInDirect).toEqual([true]);
    expect(
      (await as(teammate)(`${base}/${direct.id}/call/join`, json("POST")))
        .status,
    ).toBe(200);
    expect(
      (await as(bystander)(`${base}/${direct.id}/call/join`, json("POST")))
        .status,
    ).toBe(404);
  });

  it("removes someone who leaves a channel from its call at once", async () => {
    enableCalls();
    const livekit = await startFakeLiveKit();
    try {
      const { owner, teammate, base, as, pub } = await setup();
      await as(teammate)(`${base}/${pub.id}/join`, json("POST"));
      await as(owner)(`${base}/${pub.id}/call`, json("POST"));
      await as(teammate)(`${base}/${pub.id}/call/join`, json("POST"));

      expect(
        (await as(teammate)(`${base}/${pub.id}/leave`, json("POST"))).status,
      ).toBe(200);
      await settleEvents();

      expect(livekit.calls).toHaveLength(1);
      const [call] = livekit.calls;
      expect(call?.path).toBe("/twirp/livekit.RoomService/RemoveParticipant");
      expect(call?.body).toEqual({
        room: `chat-${pub.id}`,
        identity: teammate.user.id,
      });
      const claims = verifiedClaims(
        call?.auth.replace(/^Bearer /, "") ?? "",
        FAKE_SECRET,
      );
      expect(claims.video).toEqual({ room: `chat-${pub.id}`, roomAdmin: true });
    } finally {
      await livekit.close();
    }
  });

  it("removes someone taken out of the workspace from its calls", async () => {
    enableCalls();
    const livekit = await startFakeLiveKit();
    try {
      const { teammate, ws, base, as, dm, pub } = await setup();
      await as(teammate)(`${base}/${pub.id}/join`, json("POST"));

      await revokeWorkspaceConnections(teammate.user.id, ws, {
        role: "member",
      });
      await settleEvents();

      expect(
        livekit.calls
          .map((call) => (call.body as { room: string }).room)
          .sort(),
      ).toEqual([`chat-${dm.id}`, `chat-${pub.id}`].sort());
      for (const call of livekit.calls)
        expect(call.body).toMatchObject({ identity: teammate.user.id });
    } finally {
      await livekit.close();
    }
  });

  it("limits how often one person starts calls", async () => {
    enableCalls();
    const { owner, teammate, base, as, dm } = await setup();
    for (let i = 0; i < 10; i++)
      expect(
        (await as(owner)(`${base}/${dm.id}/call`, json("POST"))).status,
      ).toBe(200);
    const limited = await as(owner)(`${base}/${dm.id}/call`, json("POST"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    // Joining is not limited, and others keep their own budget.
    expect(
      (await as(teammate)(`${base}/${dm.id}/call`, json("POST"))).status,
    ).toBe(200);
  });

  it("stops a join token fetched before removal from working after it", async () => {
    enableCalls();
    const livekit = await startFakeLiveKit();
    try {
      const { owner, teammate, base, as, dm } = await setup();
      await as(owner)(`${base}/${dm.id}/call`, json("POST"));
      const joined = await as(teammate)(
        `${base}/${dm.id}/call/join`,
        json("POST"),
      );
      expect(joined.status).toBe(200);
      const { token } = await joined.json();
      const issuedAt = Math.floor(Date.now() / 1000);
      expect(tokenAcceptedAt(token, FAKE_SECRET, issuedAt)).toBe(true);

      // An admin takes them out of the channel.
      const removed = await as(owner)(
        `${base}/${dm.id}/members/${teammate.user.id}`,
        { method: "DELETE" },
      );
      expect(removed.status).toBe(200);
      await settleEvents();

      // LiveKit drops them now, and the token they hold expires within a
      // minute, so they cannot use it to come back.
      expect(livekit.calls.map((call) => call.body)).toEqual([
        { room: `chat-${dm.id}`, identity: teammate.user.id },
      ]);
      expect(tokenAcceptedAt(token, FAKE_SECRET, issuedAt + 61)).toBe(false);
      // Nor can they fetch a new one.
      expect(
        (await as(teammate)(`${base}/${dm.id}/call/join`, json("POST"))).status,
      ).toBe(404);
    } finally {
      await livekit.close();
    }
  });
});
