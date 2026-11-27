import { randomUUID } from "node:crypto";
import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { invalidateInstanceSettings } from "../../apps/api/src/instance-settings/get-instance-settings";
import { drainSignInEmails } from "../../apps/api/src/utils/sign-in-email-tasks";
import { signUpWithSession } from "./helpers/auth-session";
import { signInWithCustomOAuth } from "./helpers/custom-oauth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { adminApi, signInWithRole } from "./helpers/admin/instance-roles";
import { totpCode } from "./helpers/totp";
import { createSoftwarePasskey } from "./helpers/webauthn";

vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "kaneo-test";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "kaneo-test-secret";
  process.env.CUSTOM_OAUTH_AUTHORIZATION_URL =
    "https://idp.example.com/authorize";
  process.env.CUSTOM_OAUTH_TOKEN_URL = "https://idp.example.com/token";
  process.env.CUSTOM_OAUTH_SCOPES = "openid,profile,email";
});

type App = ReturnType<typeof createApp>["app"];

const PASSWORD = "correct horse battery staple";
const CLIENT_URL = "http://localhost:5173";

class CookieJar {
  private cookies = new Map<string, string>();

  constructor(header = "") {
    for (const pair of header.split("; ")) {
      const [name, ...value] = pair.split("=");
      if (name && value.length) this.cookies.set(name, value.join("="));
    }
  }

  take(response: Response) {
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const [name, ...value] = (pair ?? "").split("=");
      if (!name) continue;
      if (value.join("=") === "" || /max-age=0/i.test(setCookie)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value.join("="));
      }
    }
    return response;
  }

  header() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

let app: App;

async function authCall(
  path: string,
  jar: CookieJar,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  return jar.take(
    await app.request(path.startsWith("/api/") ? path : `/api/auth${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: CLIENT_URL,
        cookie: jar.header(),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

async function sessionUserId(jar: CookieJar) {
  const response = await authCall("/get-session", jar);
  const body = (await response.json()) as { user?: { id: string } } | null;
  return body?.user?.id ?? null;
}

async function createPasswordUser() {
  const address = `two-factor-${randomUUID()}@example.com`;
  const { userId, cookies } = await signUpWithSession(app, {
    email: address,
    name: "Two Factor",
  });
  await db
    .update(schema.userTable)
    .set({ emailVerified: true })
    .where(eq(schema.userTable.id, userId));
  return { userId, email: address, jar: new CookieJar(cookies) };
}

async function enableTwoFactor(jar: CookieJar) {
  const enable = await authCall("/two-factor/enable", jar, {
    password: PASSWORD,
  });
  expect(enable.status, await enable.clone().text()).toBe(200);
  const body = (await enable.json()) as {
    method?: string;
    totpURI: string;
    backupCodes: string[];
  };
  // The web setup flow reads the URI only from a TOTP enrollment.
  expect(body.method).toBe("totp");
  const { totpURI, backupCodes } = body;
  const verify = await authCall("/two-factor/verify-totp", jar, {
    code: totpCode(totpURI),
  });
  expect(verify.status).toBe(200);
  return { totpURI, backupCodes };
}

async function userWithTwoFactor() {
  const user = await createPasswordUser();
  return { ...user, ...(await enableTwoFactor(user.jar)) };
}

async function passwordSignIn(address: string, jar = new CookieJar()) {
  const response = await authCall("/sign-in/email", jar, {
    email: address,
    password: PASSWORD,
  });
  return { response, jar };
}

async function emailCodeSignIn(address: string, jar = new CookieJar()) {
  const send = vi.spyOn(email, "sendOtpEmail").mockResolvedValue(undefined);
  expect(
    (
      await authCall("/email-otp/send-verification-otp", jar, {
        email: address,
        type: "sign-in",
      })
    ).status,
  ).toBe(200);
  await drainSignInEmails();
  const { otp } = (send.mock.lastCall?.[2] ?? {}) as { otp: string };
  const response = await authCall("/sign-in/email-otp", jar, {
    email: address,
    otp,
  });
  return { response, jar };
}

async function setRequireTwoFactor(value: boolean) {
  await db
    .insert(schema.instanceSettingsTable)
    .values({ id: "instance", requireTwoFactor: value })
    .onConflictDoUpdate({
      target: schema.instanceSettingsTable.id,
      set: { requireTwoFactor: value },
    });
  invalidateInstanceSettings();
}

beforeEach(async () => {
  await resetTestDatabase();
  await createWorkspaceMember();
  ({ app } = createApp());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("two-factor sign-in", () => {
  it("asks a password sign-in for a code, refuses a wrong one and accepts the right one", async () => {
    const user = await userWithTwoFactor();

    const { response, jar } = await passwordSignIn(user.email);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(await sessionUserId(jar)).toBeNull();

    const wrong = await authCall("/two-factor/verify-totp", jar, {
      code: totpCode(user.totpURI, Date.now() - 10 * 60_000),
    });
    expect(wrong.status).toBe(401);
    expect(await sessionUserId(jar)).toBeNull();

    const right = await authCall("/two-factor/verify-totp", jar, {
      code: totpCode(user.totpURI),
    });
    expect(right.status).toBe(200);
    expect(await sessionUserId(jar)).toBe(user.userId);
  });

  it("accepts each recovery code once", async () => {
    const user = await userWithTwoFactor();
    const [first, second] = user.backupCodes;

    const firstUse = await passwordSignIn(user.email);
    expect(
      (
        await authCall("/two-factor/verify-backup-code", firstUse.jar, {
          code: first,
        })
      ).status,
    ).toBe(200);
    expect(await sessionUserId(firstUse.jar)).toBe(user.userId);

    const reuse = await passwordSignIn(user.email);
    expect(
      (
        await authCall("/two-factor/verify-backup-code", reuse.jar, {
          code: first,
        })
      ).status,
    ).toBe(401);
    expect(await sessionUserId(reuse.jar)).toBeNull();
    expect(
      (
        await authCall("/two-factor/verify-backup-code", reuse.jar, {
          code: second,
        })
      ).status,
    ).toBe(200);
    expect(await sessionUserId(reuse.jar)).toBe(user.userId);
  });

  it("asks an email-code sign-in for the second step", async () => {
    const user = await userWithTwoFactor();

    const { response, jar } = await emailCodeSignIn(user.email);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(await sessionUserId(jar)).toBeNull();

    await authCall("/two-factor/verify-totp", jar, {
      code: totpCode(user.totpURI),
    });
    expect(await sessionUserId(jar)).toBe(user.userId);
  });

  it("sends a magic link sign-in to the two-factor page without a session", async () => {
    const user = await userWithTwoFactor();
    vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
    const send = vi
      .spyOn(email, "sendMagicLinkEmail")
      .mockResolvedValue(undefined);
    const jar = new CookieJar();
    expect(
      (
        await authCall("/sign-in/magic-link", jar, {
          email: user.email,
          callbackURL: `${CLIENT_URL}/dashboard`,
        })
      ).status,
    ).toBe(200);
    await drainSignInEmails();
    const { magicLink } = (send.mock.lastCall?.[2] ?? {}) as {
      magicLink: string;
    };
    const link = new URL(magicLink);

    const response = await authCall(`${link.pathname}${link.search}`, jar);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `${CLIENT_URL}/auth/two-factor`,
    );
    expect(await sessionUserId(jar)).toBeNull();

    await authCall("/two-factor/verify-totp", jar, {
      code: totpCode(user.totpURI),
    });
    expect(await sessionUserId(jar)).toBe(user.userId);
  });

  it("sends an OAuth sign-in to the two-factor page without a session", async () => {
    const user = await userWithTwoFactor();
    const sessionsOf = () =>
      db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, user.userId));
    const before = (await sessionsOf()).length;

    const response = await signInWithCustomOAuth(app, {
      sub: "idp-two-factor",
      email: user.email,
      email_verified: true,
      name: "Two Factor",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `${CLIENT_URL}/auth/two-factor`,
    );
    const jar = new CookieJar();
    jar.take(response);
    expect(await sessionUserId(jar)).toBeNull();
    expect(await sessionsOf()).toHaveLength(before);
  });

  it("does not turn a guest session into the account before the second step", async () => {
    const user = await userWithTwoFactor();
    const jar = new CookieJar();
    const guest = await authCall("/sign-in/anonymous", jar, {});
    expect(guest.status).toBe(200);
    const guestId = await sessionUserId(jar);
    expect(guestId).not.toBeNull();

    const { response } = await emailCodeSignIn(user.email, jar);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(await sessionUserId(jar)).not.toBe(user.userId);
    const [guestRow] = await db
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, guestId ?? ""));
    expect(guestRow).toBeDefined();
  });

  it("signs in without a second step when two-factor is off", async () => {
    const user = await createPasswordUser();
    const { response, jar } = await passwordSignIn(user.email);
    expect(await response.json()).not.toHaveProperty("twoFactorRedirect");
    expect(await sessionUserId(jar)).toBe(user.userId);
  });
});

describe("require two-factor", () => {
  it("lets only instance administrators require two-factor", async () => {
    const admin = await signInWithRole(app, "admin");
    const member = await signInWithRole(app, "user");

    expect(
      (
        await member.api("/settings", {
          method: "PATCH",
          body: { requireTwoFactor: true },
        })
      ).status,
    ).toBe(403);
    const response = await admin.api("/settings", {
      method: "PATCH",
      body: { requireTwoFactor: true },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ requireTwoFactor: true });
  });

  it("holds a password user to setting it up at the next sign-in", async () => {
    const user = await createPasswordUser();
    const before = user.jar;
    await setRequireTwoFactor(true);

    // A session from before the requirement keeps working.
    expect((await authCall("/api/notification", before)).status).toBe(200);

    const { jar } = await passwordSignIn(user.email);
    expect(await sessionUserId(jar)).toBe(user.userId);
    const session = (await (await authCall("/get-session", jar)).json()) as {
      session: { twoFactorSetupRequired?: boolean };
    };
    expect(session.session.twoFactorSetupRequired).toBe(true);

    const blocked = await authCall("/api/notification", jar);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      code: "TWO_FACTOR_SETUP_REQUIRED",
    });
    expect(
      (await authCall("/api-key/create", jar, { name: "sneaky" })).status,
    ).toBe(403);
    expect((await authCall("/organization/list", jar)).status).toBe(403);

    await enableTwoFactor(jar);
    expect((await authCall("/api/notification", jar)).status).toBe(200);

    const disable = await authCall("/two-factor/disable", jar, {
      password: PASSWORD,
    });
    expect(disable.status).toBe(403);
  });

  it("holds a password user who signs in another way too", async () => {
    const user = await createPasswordUser();
    await setRequireTwoFactor(true);

    const { jar } = await emailCodeSignIn(user.email);
    expect((await authCall("/api/notification", jar)).status).toBe(403);
  });

  it("does not hold users without a password", async () => {
    const [user] = await db
      .insert(schema.userTable)
      .values({
        id: `user-${randomUUID()}`,
        email: `no-password-${randomUUID()}@example.com`,
        emailVerified: true,
        name: "No Password",
      })
      .returning();
    await setRequireTwoFactor(true);

    const { jar } = await emailCodeSignIn(user.email);
    expect(await sessionUserId(jar)).toBe(user.id);
    expect((await authCall("/api/notification", jar)).status).toBe(200);
  });
});

/** A code that is not valid in the current, previous or next window. */
function wrongCode(totpURI: string) {
  const now = Date.now();
  const valid = new Set(
    [now - 30_000, now, now + 30_000].map((at) => totpCode(totpURI, at)),
  );
  return ["000000", "111111", "222222", "333333"].find((c) => !valid.has(c));
}

async function passkeySignIn(userId: string, userVerified: boolean) {
  const key = createSoftwarePasskey();
  await db.insert(schema.passkeyTable).values({
    id: `passkey-${randomUUID()}`,
    name: "Laptop",
    userId,
    publicKey: key.publicKey,
    credentialID: key.credentialID,
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
  });
  const jar = new CookieJar();
  const options = await authCall("/passkey/generate-authenticate-options", jar);
  const { challenge } = (await options.json()) as { challenge: string };
  const response = await authCall("/passkey/verify-authentication", jar, {
    response: key.assert(challenge, {
      origin: CLIENT_URL,
      rpID: "localhost",
      userVerified,
    }),
  });
  return { response, jar };
}

describe("API integration: two-factor secrets, passkeys and resets", () => {
  // The settings cache outlives the database reset between tests.
  beforeEach(() => invalidateInstanceSettings());

  it("asks for a current code before showing the secret or new recovery codes", async () => {
    const user = await userWithTwoFactor();
    for (const path of [
      "/two-factor/get-totp-uri",
      "/two-factor/generate-backup-codes",
    ]) {
      const bare = await authCall(path, user.jar, { password: PASSWORD });
      expect(bare.status, path).toBe(403);
      expect(await bare.json()).toMatchObject({
        code: "TWO_FACTOR_CODE_REQUIRED",
      });

      const wrong = await authCall(path, user.jar, {
        password: PASSWORD,
        code: wrongCode(user.totpURI),
      });
      expect(wrong.status, path).toBe(403);
      expect(await wrong.json()).toMatchObject({
        code: "INVALID_TWO_FACTOR_CODE",
      });

      const fresh = await authCall(path, user.jar, {
        password: PASSWORD,
        code: totpCode(user.totpURI),
      });
      expect(fresh.status, path).toBe(200);
    }
  });

  it("shows the secret with the password alone while setup is unfinished", async () => {
    const user = await createPasswordUser();
    const enable = await authCall("/two-factor/enable", user.jar, {
      password: PASSWORD,
    });
    expect(enable.status).toBe(200);
    const uri = await authCall("/two-factor/get-totp-uri", user.jar, {
      password: PASSWORD,
    });
    expect(uri.status).toBe(200);
  });

  it("counts a passkey that verified the person as both factors", async () => {
    const user = await userWithTwoFactor();
    const { response, jar } = await passkeySignIn(user.userId, true);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await sessionUserId(jar)).toBe(user.userId);
  });

  it("refuses a passkey that did not verify the person once two-factor is on", async () => {
    const user = await userWithTwoFactor();
    const { response, jar } = await passkeySignIn(user.userId, false);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: "PASSKEY_USER_VERIFICATION_REQUIRED",
    });
    expect(await sessionUserId(jar)).toBeNull();
  });

  it("refuses it when the instance requires two-factor, too", async () => {
    const user = await createPasswordUser();
    await setRequireTwoFactor(true);
    const { response } = await passkeySignIn(user.userId, false);
    await setRequireTwoFactor(false);
    expect(response.status).toBe(401);
  });

  it("keeps such a passkey working for someone without two-factor", async () => {
    const user = await createPasswordUser();
    const { response, jar } = await passkeySignIn(user.userId, false);
    expect(response.status).toBe(200);
    expect(await sessionUserId(jar)).toBe(user.userId);
  });

  it("lets only instance administrators reset someone's two-factor", async () => {
    const user = await userWithTwoFactor();
    const admin = await signInWithRole(app, "admin");
    const member = await signInWithRole(app, "user");
    const path = `/users/${user.userId}/two-factor`;

    expect((await member.api(path, { method: "DELETE" })).status).toBe(403);
    expect((await passwordSignIn(user.email)).response.status).toBe(200);
    const stillOn = await passwordSignIn(user.email);
    expect(await sessionUserId(stillOn.jar)).toBeNull();

    const reset = await admin.api(path, { method: "DELETE" });
    expect(reset.status).toBe(200);
    expect(await reset.json()).toEqual({ twoFactorEnabled: false });
    expect(
      await db
        .select()
        .from(schema.twoFactorTable)
        .where(eq(schema.twoFactorTable.userId, user.userId)),
    ).toHaveLength(0);

    const { jar } = await passwordSignIn(user.email);
    expect(await sessionUserId(jar)).toBe(user.userId);
    const [entry] = await db
      .select()
      .from(schema.adminAuditLogTable)
      .where(eq(schema.adminAuditLogTable.action, "user.two_factor_reset"));
    expect(entry).toMatchObject({ targetId: user.userId });
  });

  it("does not let an administrator reset their own two-factor", async () => {
    const admin = await signInWithRole(app, "admin");
    // Turning two-factor on replaces the session.
    const jar = new CookieJar(admin.cookies);
    await enableTwoFactor(jar);
    const api = adminApi(app, { cookie: jar.header() });
    const response = await api(`/users/${admin.userId}/two-factor`, {
      method: "DELETE",
    });
    expect(response.status).toBe(409);
    const [user] = await db
      .select({ enabled: schema.userTable.twoFactorEnabled })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, admin.userId));
    expect(user?.enabled).toBe(true);
  });

  it("returns 404 for a user that does not exist", async () => {
    const admin = await signInWithRole(app, "admin");
    const response = await admin.api(`/users/user-${randomUUID()}/two-factor`, {
      method: "DELETE",
    });
    expect(response.status).toBe(404);
  });
});
