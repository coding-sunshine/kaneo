import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
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
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { startFakePushServices } from "./helpers/fake-push-services";
import { createWorkspaceMember } from "./helpers/fixtures";

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;
type Fake = Awaited<ReturnType<typeof startFakePushServices>>;

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

let fake: Fake;
const PUSH_ENV = [
  "APNS_KEY_ID",
  "APNS_TEAM_ID",
  "APNS_PRIVATE_KEY",
  "APNS_HOST",
  "FCM_SERVICE_ACCOUNT",
  "FCM_HOST",
];
const pushOn = () => {
  for (const [name, value] of Object.entries(fake.env)) vi.stubEnv(name, value);
};
const pushOff = () => {
  for (const name of PUSH_ENV) vi.stubEnv(name, "");
};

beforeAll(async () => {
  fake = await startFakePushServices();
});
afterAll(async () => {
  await fake.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// The mocked session needs a real row: a device belongs to a session.
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
  const outsider = await createWorkspaceMember();
  const ws = a.workspace.id;
  for (const member of [b, c])
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  for (const member of [a, b, c, outsider]) await signIn(member);
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const register = (member: Seeded, token: string, platform = "ios") =>
    as(member)("/api/push/device", json("PUT", { platform, token }));
  const unregister = (member: Seeded, token: string) =>
    as(member)("/api/push/device", json("DELETE", { token }));
  const create = async (name: string, isPrivate = false) =>
    (await as(a)(base, json("POST", { name, isPrivate }))).json();
  const post = async (channelId: string, body: string, member = a) => {
    const response = await as(member)(
      `${base}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status).toBe(200);
    await settleEvents();
  };
  const devices = () => db.select().from(pushDeviceTable);
  return {
    a,
    b,
    c,
    outsider,
    ws,
    app,
    base,
    as,
    register,
    unregister,
    create,
    post,
    devices,
  };
}

const devices = () => db.select().from(pushDeviceTable);

describe("API integration: push devices", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    fake.pushes.length = 0;
    fake.deadTokens.clear();
  });

  it("refuses to register a device without a sign-in", async () => {
    const { app } = await setup();
    mockAnonymousSession();
    const response = await app.request(
      "/api/push/device",
      json("PUT", { platform: "ios", token: "abc" }),
    );
    expect(response.status).toBe(401);
  });

  it("refuses to register a device with an API key", async () => {
    const { b, app } = await setup();
    // A device rides on a session, which sign-out and revoke end; a key has none.
    const key = `push-device-${b.user.id}`.padEnd(64, "x");
    await db.insert(schema.apikeyTable).values({
      referenceId: b.user.id,
      userId: b.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      permissions: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const response = await app.request("/api/push/device", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ platform: "ios", token: "abc" }),
    });
    expect(response.status).toBe(403);
  });

  it("says whether the server can deliver to the platform", async () => {
    const { b, register } = await setup();
    pushOff();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await (await register(b, "ios-1")).json()).toEqual({
      delivering: false,
    });
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("iOS push is off"),
    );
    pushOn();
    expect(await (await register(b, "ios-1")).json()).toEqual({
      delivering: true,
    });
    expect(await (await register(b, "android-1", "android")).json()).toEqual({
      delivering: true,
    });
  });

  it("moves a token to whoever registers it last", async () => {
    const { b, c, register, devices } = await setup();
    await register(b, "shared");
    await register(c, "shared");
    const rows = await devices();
    expect(rows.map((row) => row.userId)).toEqual([c.user.id]);
  });

  it("lets you remove only your own device", async () => {
    const { b, c, register, unregister, devices } = await setup();
    await register(b, "b-phone");
    expect(await (await unregister(c, "b-phone")).json()).toEqual({
      removed: false,
    });
    expect(await devices()).toHaveLength(1);
    expect(await (await unregister(b, "b-phone")).json()).toEqual({
      removed: true,
    });
    expect(await devices()).toHaveLength(0);
  });

  it("keeps a device for a real sign-in and drops it at sign-out", async () => {
    const { app } = createApp();
    const { cookies } = await signUpWithSession(app, {
      email: "push-signin@example.test",
      name: "Push Tester",
    });
    const headers = { "content-type": "application/json", cookie: cookies };
    const registered = await app.request("/api/push/device", {
      method: "PUT",
      headers,
      body: JSON.stringify({ platform: "android", token: "real-phone" }),
    });
    expect(registered.status).toBe(200);
    expect(await devices()).toHaveLength(1);

    const signedOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers,
      body: "{}",
    });
    expect(signedOut.status).toBe(200);
    expect(await devices()).toHaveLength(0);
  });

  it("drops the device when its session ends", async () => {
    const { b, register, devices } = await setup();
    await register(b, "b-phone");
    await db
      .delete(schema.sessionTable)
      .where(eq(schema.sessionTable.id, `session-${b.user.id}`));
    expect(await devices()).toHaveLength(0);
  });
});

describe("API integration: chat pushes", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    fake.pushes.length = 0;
    fake.deadTokens.clear();
  });

  it("pushes a new message to the other members' phones, opening its channel", async () => {
    const { a, b, ws, as, base, create, register, post } = await setup();
    pushOn();
    const general = await create("general");
    await as(b)(`${base}/${general.id}/join`, json("POST"));
    await register(a, "a-phone");
    await register(b, "b-iphone");
    await register(b, "b-android", "android");

    await post(general.id, "Ship it");

    expect(fake.pushes).toHaveLength(2);
    for (const push of fake.pushes)
      expect(push).toMatchObject({
        title: "#general",
        body: "Writer: Ship it",
        data: { kind: "chat", workspaceId: ws, chatChannelId: general.id },
      });
    expect(fake.pushes.map((push) => push.token).sort()).toEqual([
      "b-android",
      "b-iphone",
    ]);
  });

  it("pushes nothing to people who cannot read the channel", async () => {
    const { b, c, outsider, as, base, create, register, post } = await setup();
    pushOn();
    const leads = await create("leads", true);
    const general = await create("general");
    await as(c)(`${base}/${general.id}/join`, json("POST"));
    await register(b, "b-phone");
    await register(c, "c-phone");
    await register(outsider, "outsider-phone");

    // b and the outsider are not in the private channel.
    await post(leads.id, "secret");
    expect(fake.pushes).toEqual([]);

    // c left the workspace but is still a channel member.
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, c.user.id));
    await post(general.id, "after c left");
    expect(fake.pushes).toEqual([]);
  });

  // The off line is logged once per process; the registration test checks it.
  it("sends nothing while push is off", async () => {
    const { b, as, base, create, register, post } = await setup();
    pushOff();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const general = await create("general");
    await as(b)(`${base}/${general.id}/join`, json("POST"));
    await register(b, "b-phone");
    await post(general.id, "hello");
    expect(fake.pushes).toEqual([]);
  });

  it("pushes nothing to a phone whose session has expired", async () => {
    const { b, as, base, create, register, post } = await setup();
    pushOn();
    const general = await create("general");
    await as(b)(`${base}/${general.id}/join`, json("POST"));
    await register(b, "b-phone");
    await db
      .update(schema.sessionTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.sessionTable.id, `session-${b.user.id}`));
    await post(general.id, "hello");
    expect(fake.pushes).toEqual([]);
  });

  it("pushes nothing to a member who has not joined a public channel", async () => {
    const { b, create, register, post } = await setup();
    pushOn();
    const general = await create("general");
    await register(b, "b-phone");
    await post(general.id, "hello");
    expect(fake.pushes).toEqual([]);
  });

  it("forgets a token the provider says is gone", async () => {
    const { b, as, base, create, register, post, devices } = await setup();
    pushOn();
    const general = await create("general");
    await as(b)(`${base}/${general.id}/join`, json("POST"));
    await register(b, "gone-iphone");
    await register(b, "gone-android", "android");
    fake.deadTokens.add("gone-iphone");
    fake.deadTokens.add("gone-android");
    await post(general.id, "hello");
    expect(await devices()).toEqual([]);
  });
});
