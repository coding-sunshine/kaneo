import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

type App = ReturnType<typeof createApp>["app"];

let app: App;
let alice: { userId: string; cookies: string };
let bob: { userId: string; cookies: string };

const origin = "http://localhost:5173";
const request = (path: string, cookies?: string, body?: unknown) =>
  app.request(`/api/auth/passkey/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      ...(cookies ? { cookie: cookies } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const addPasskey = (userId: string, id: string) =>
  db.insert(schema.passkeyTable).values({
    id,
    name: id,
    userId,
    publicKey: "key",
    credentialID: `cred-${id}`,
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
  });

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  alice = await signUpWithSession(app, {
    email: "alice@example.com",
    name: "Alice",
  });
  bob = await signUpWithSession(app, { email: "bob@example.com", name: "Bob" });
});

describe("API integration: passkeys", () => {
  it("mounts sign-in options for anonymous callers and registration only for sessions", async () => {
    const options = await request("generate-authenticate-options");
    expect(options.status).toBe(200);
    expect(await options.json()).toMatchObject({
      rpId: "localhost",
      challenge: expect.any(String),
    });

    expect((await request("generate-register-options")).status).toBe(401);
    const register = await request("generate-register-options", alice.cookies);
    expect(register.status).toBe(200);
    expect(await register.json()).toMatchObject({
      rp: { id: "localhost" },
      user: { name: "alice@example.com" },
    });
  });

  it("lists only the caller's passkeys", async () => {
    await addPasskey(alice.userId, "alice-key");
    await addPasskey(bob.userId, "bob-key");

    expect((await request("list-user-passkeys")).status).toBe(401);
    const list = await request("list-user-passkeys", alice.cookies);
    const body = (await list.json()) as Array<{ id: string }>;
    expect(body.map(({ id }) => id)).toEqual(["alice-key"]);
  });

  it("refuses to delete or rename another user's passkey", async () => {
    await addPasskey(bob.userId, "bob-key");

    const anonymous = await request("delete-passkey", undefined, {
      id: "bob-key",
    });
    expect(anonymous.status).toBe(401);
    const denied = await request("delete-passkey", alice.cookies, {
      id: "bob-key",
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    const renamed = await request("update-passkey", alice.cookies, {
      id: "bob-key",
      name: "mine",
    });
    expect(renamed.status).toBeGreaterThanOrEqual(400);

    const [row] = await db
      .select()
      .from(schema.passkeyTable)
      .where(eq(schema.passkeyTable.id, "bob-key"));
    expect(row).toMatchObject({ userId: bob.userId, name: "bob-key" });
  });

  it("lets the owner delete their passkey", async () => {
    await addPasskey(alice.userId, "alice-key");

    const response = await request("delete-passkey", alice.cookies, {
      id: "alice-key",
    });
    expect(response.status).toBe(200);
    expect(await db.select().from(schema.passkeyTable)).toHaveLength(0);
  });
});
