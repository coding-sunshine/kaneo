import { createHmac } from "node:crypto";
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
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// A fake LiveKit deployment: the API only signs tokens with these values.
const FAKE_URL = "wss://calls.example.test";
const FAKE_KEY = "fake-livekit-key";
const FAKE_SECRET = "fake-livekit-secret-that-is-long-enough";

const rings: { callerId: string; recipientIds: string[] }[] = [];
subscribeToEvent<{ callerId: string; recipientIds: string[] }>(
  "chat.call_started",
  async (data) => {
    rings.push({ callerId: data.callerId, recipientIds: data.recipientIds });
  },
);

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
});
