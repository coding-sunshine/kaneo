import { createHash } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { pushDeviceTable } from "../../apps/api/src/database/schema";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { startFakeWebPush } from "./helpers/fake-web-push";
import { createWorkspaceMember } from "./helpers/fixtures";

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;
type Fake = Awaited<ReturnType<typeof startFakeWebPush>>;
type Subscription = ReturnType<Fake["subscribe"]>;

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const mention = (id: string) =>
  `<kaneo-mention id="${id}" label="Reader">@Reader</kaneo-mention>`;

let fake: Fake;
const webPushOn = () => {
  for (const [name, value] of Object.entries(fake.env)) vi.stubEnv(name, value);
};
const webPushOff = () => {
  for (const name of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"])
    vi.stubEnv(name, "");
};

beforeAll(async () => {
  fake = await startFakeWebPush();
});
afterAll(async () => {
  await fake.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function signIn(member: Seeded) {
  await db
    .insert(schema.sessionTable)
    .values({
      id: `session-${member.user.id}`,
      token: `token-${member.user.id}`,
      userId: member.user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
}

async function setup() {
  const a = await createWorkspaceMember({ role: "owner", userName: "Writer" });
  const b = await createWorkspaceMember();
  const c = await createWorkspaceMember();
  const ws = a.workspace.id;
  for (const member of [b, c])
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  for (const member of [a, b, c]) await signIn(member);
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const subscribe = (member: Seeded, subscription: Subscription) =>
    as(member)(
      "/api/push/device",
      json("PUT", { platform: "web", subscription }),
    );
  const unsubscribe = (member: Seeded, subscription: Subscription) =>
    as(member)("/api/push/device", json("DELETE", { subscription }));
  const create = async (name: string, isPrivate = false) =>
    (await (await as(a)(base, json("POST", { name, isPrivate }))).json()) as {
      id: string;
    };
  const join = (member: Seeded, channelId: string) =>
    as(member)(`${base}/${channelId}/join`, json("POST"));
  const post = async (channelId: string, body: string, member = a) => {
    const response = await as(member)(
      `${base}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status).toBe(200);
    await settleEvents();
    return (await response.json()) as { id: string };
  };
  const openDirect = async (member: Seeded, others: Seeded[]) =>
    (await (
      await as(member)(
        `/api/chat/workspace/${ws}/direct-messages`,
        json("POST", { userIds: others.map((o) => o.user.id) }),
      )
    ).json()) as { id: string };
  return {
    a,
    b,
    c,
    ws,
    app,
    as,
    subscribe,
    unsubscribe,
    create,
    join,
    post,
    openDirect,
  };
}

describe("API integration: desktop push", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    fake.pushes.length = 0;
    fake.rejected.length = 0;
    fake.gone.clear();
  });

  // Runs first: the off line is logged once per process.
  it("logs once that desktop push is off without the key pair", async () => {
    const { b, subscribe } = await setup();
    webPushOff();
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = await subscribe(b, fake.subscribe("b-browser"));
    expect(await response.json()).toEqual({ delivering: false });
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Desktop push is off"),
    );
  });

  it("hands out the public key, or null while the server has no key pair", async () => {
    const { b, as } = await setup();
    vi.spyOn(console, "info").mockImplementation(() => {});
    webPushOff();
    const off = await as(b)("/api/push/web-key");
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ publicKey: null });
    webPushOn();
    expect(await (await as(b)("/api/push/web-key")).json()).toEqual({
      publicKey: fake.publicKey,
    });
  });

  it("refuses a browser subscription without a sign-in or with an API key", async () => {
    const { b, app } = await setup();
    mockAnonymousSession();
    const body = JSON.stringify({
      platform: "web",
      subscription: fake.subscribe("anon"),
    });
    const anonymous = await app.request("/api/push/device", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(anonymous.status).toBe(401);
    expect((await app.request("/api/push/web-key")).status).toBe(401);

    const key = `web-push-${b.user.id}`.padEnd(64, "x");
    await db.insert(schema.apikeyTable).values({
      referenceId: b.user.id,
      userId: b.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      permissions: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const withKey = await app.request("/api/push/device", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-api-key": key },
      body,
    });
    expect(withKey.status).toBe(403);
    expect(await db.select().from(pushDeviceTable)).toEqual([]);
  });

  it("refuses a subscription with broken keys or a plain-http endpoint", async () => {
    const { b, subscribe } = await setup();
    const good = fake.subscribe("b-browser");
    const shortKey = await subscribe(b, {
      ...good,
      keys: { ...good.keys, p256dh: "AAAA" },
    });
    expect(shortKey.status).toBe(400);
    // Outside a dev setup that allows private destinations, http is refused.
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
    expect((await subscribe(b, good)).status).toBe(400);
    expect(await db.select().from(pushDeviceTable)).toEqual([]);
  });

  it("shows a mention on the desktop with the channel and the sender, opening the message", async () => {
    const { a, b, ws, create, join, post, subscribe } = await setup();
    webPushOn();
    const general = await create("general");
    await join(b, general.id);
    const registered = await subscribe(b, fake.subscribe("b-browser"));
    expect(await registered.json()).toEqual({ delivering: true });

    const sent = await post(general.id, `${mention(b.user.id)} ship it`, a);

    expect(fake.rejected).toEqual([]);
    expect(fake.pushes).toEqual([
      {
        subscription: "b-browser",
        payload: {
          title: "#general",
          body: "Writer: @Reader ship it",
          tag: sent.id,
          data: {
            kind: "chat",
            workspaceId: ws,
            chatChannelId: general.id,
            messageId: sent.id,
          },
        },
      },
    ]);
  });

  it("shows a direct message but nothing for a plain channel message", async () => {
    const { a, b, create, join, post, subscribe, openDirect } = await setup();
    webPushOn();
    const general = await create("general");
    await join(b, general.id);
    await subscribe(b, fake.subscribe("b-browser"));

    await post(general.id, "plain update");
    expect(fake.pushes).toEqual([]);

    const direct = await openDirect(a, [b]);
    await post(direct.id, "quick question");
    expect(fake.pushes).toHaveLength(1);
    expect(fake.pushes[0]?.payload).toMatchObject({
      title: "Writer",
      body: "quick question",
    });
  });

  it("shows nothing to someone mentioned in a channel they cannot read", async () => {
    const { b, create, post, subscribe } = await setup();
    webPushOn();
    const leads = await create("leads", true);
    await subscribe(b, fake.subscribe("b-browser"));
    await post(leads.id, `${mention(b.user.id)} secret`);
    expect(fake.pushes).toEqual([]);
  });

  it("stops after the browser unsubscribes, and only its owner can remove it", async () => {
    const { b, c, create, join, post, subscribe, unsubscribe } = await setup();
    webPushOn();
    const general = await create("general");
    await join(b, general.id);
    const subscription = fake.subscribe("b-browser");
    await subscribe(b, subscription);

    const stranger = await unsubscribe(c, subscription);
    expect(await stranger.json()).toEqual({ removed: false });
    expect(await (await unsubscribe(b, subscription)).json()).toEqual({
      removed: true,
    });

    await post(general.id, `${mention(b.user.id)} still there?`);
    expect(fake.pushes).toEqual([]);
  });

  it("sends nothing while the key pair is missing", async () => {
    const { b, create, join, post, subscribe } = await setup();
    webPushOn();
    const general = await create("general");
    await join(b, general.id);
    await subscribe(b, fake.subscribe("b-browser"));
    webPushOff();
    vi.spyOn(console, "info").mockImplementation(() => {});
    await post(general.id, `${mention(b.user.id)} hello`);
    expect(fake.pushes).toEqual([]);
  });

  it("forgets a subscription the push service says is gone", async () => {
    const { b, create, join, post, subscribe } = await setup();
    webPushOn();
    const general = await create("general");
    await join(b, general.id);
    await subscribe(b, fake.subscribe("b-browser"));
    fake.gone.add("b-browser");
    await post(general.id, `${mention(b.user.id)} hello`);
    expect(await db.select().from(pushDeviceTable)).toEqual([]);
  });

  it("never posts to a private address unless the server allows it", async () => {
    const { b, create, join, post, subscribe } = await setup();
    webPushOn();
    const general = await create("general");
    await join(b, general.id);
    await subscribe(b, fake.subscribe("b-browser"));
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "");
    await post(general.id, `${mention(b.user.id)} hello`);
    expect(fake.pushes).toEqual([]);
    expect(fake.rejected).toEqual([]);
    expect(await db.select().from(pushDeviceTable)).toHaveLength(1);
  });
});
