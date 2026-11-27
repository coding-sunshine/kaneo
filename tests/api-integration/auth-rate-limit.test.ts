import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";

type AppModule = typeof import("../../apps/api/src/index");
type AuthModule = typeof import("../../apps/api/src/auth");
type App = ReturnType<AppModule["createApp"]>["app"];

const PROXY = "10.9.0.5";
const originalTrustedProxies = process.env.TRUSTED_PROXIES;

// The auth instance reads its settings at import, so each mode imports it
// again after setting the variables a self-hosted instance controls.
async function load(trustedProxies: string | undefined) {
  delete process.env.KANEO_CLOUD;
  delete process.env.DISABLE_AUTH_RATE_LIMIT;
  if (trustedProxies === undefined) delete process.env.TRUSTED_PROXIES;
  else process.env.TRUSTED_PROXIES = trustedProxies;
  vi.resetModules();
  const { auth } = (await import("../../apps/api/src/auth")) as AuthModule;
  const { app } = (await import("../../apps/api/src/index")).createApp();
  return { auth, app };
}

afterAll(() => {
  if (originalTrustedProxies === undefined) delete process.env.TRUSTED_PROXIES;
  else process.env.TRUSTED_PROXIES = originalTrustedProxies;
  process.env.DISABLE_AUTH_RATE_LIMIT = "true";
});

type Attempt = {
  path?: string;
  body?: string;
  contentType?: string;
  cookie?: string;
  forwardedFor?: string;
};

/** Every request reaches the API from the same proxy container. */
function attempt(app: App, options: Attempt) {
  const headers: Record<string, string> = {
    "content-type": options.contentType ?? "application/json",
    Origin: "http://localhost:5173",
  };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.forwardedFor) headers["x-forwarded-for"] = options.forwardedFor;
  const get = options.path?.endsWith("/get-session");
  return app.request(
    options.path ?? "/api/auth/sign-in/email",
    get
      ? { method: "GET", headers }
      : { method: "POST", headers, body: options.body ?? "{}" },
    { incoming: { socket: { remoteAddress: PROXY } } },
  );
}

const PASSWORD = "right-password-123";
const signInBody = (email: string, password = "wrong-password-123") =>
  JSON.stringify({ email, password });

/** A cookie value signed like the ones Better Auth issues. */
async function signed(auth: AuthModule["auth"], value: string) {
  const { secret } = await auth.$context;
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return encodeURIComponent(`${value}.${signature}`);
}

/** A user who signs in with PASSWORD, made without going through the API. */
async function createPasswordUser(auth: AuthModule["auth"]) {
  const context = await auth.$context;
  const email = `victim-${randomUUID()}@example.test`;
  const user = await context.internalAdapter.createUser({
    email,
    name: "Victim",
    emailVerified: true,
  });
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(PASSWORD),
  });
  return { email, userId: user.id };
}

/** A real session cookie of the user, from signing in through the API. */
async function signInCookie(app: App, auth: AuthModule["auth"], email: string) {
  const { authCookies } = await auth.$context;
  const response = await attempt(app, { body: signInBody(email, PASSWORD) });
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${authCookies.sessionToken.name}=`));
  return (cookie ?? "").split(";")[0] ?? "";
}

/** A pending two-factor sign-in of the user, stored as Better Auth does. */
async function pendingSignInCookie(auth: AuthModule["auth"], userId: string) {
  const context = await auth.$context;
  const identifier = `2fa-${randomUUID()}`;
  await context.internalAdapter.createVerificationValue({
    identifier,
    value: userId,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  const name = context.createAuthCookie("two_factor").name;
  return `${name}=${await signed(auth, identifier)}`;
}

async function statuses(app: App, count: number, options: () => Attempt) {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push((await attempt(app, options())).status);
  }
  return result;
}

describe("auth rate limits without TRUSTED_PROXIES", () => {
  let app: App;
  let auth: AuthModule["auth"];

  beforeAll(async () => {
    await resetTestDatabase();
    ({ app, auth } = await load(undefined));
  });

  it("is enabled when KANEO_CLOUD is unset", () => {
    expect(auth.options.rateLimit?.enabled).toBe(true);
  });

  it("locks one account out without locking out others behind the proxy", async () => {
    const locked = await statuses(app, 4, () => ({
      body: signInBody("locked-out@example.test"),
    }));
    expect(locked.slice(0, 3)).not.toContain(429);
    expect(locked[3]).toBe(429);

    const other = await attempt(app, {
      body: signInBody("someone-else@example.test"),
    });
    expect(other.status).not.toBe(429);
  });

  it("treats a differently cased email as the same account", async () => {
    await statuses(app, 3, () => ({ body: signInBody("cased@example.test") }));
    const variant = await attempt(app, {
      body: signInBody("  CASED@Example.TEST "),
    });
    expect(variant.status).toBe(429);
  });

  it("limits form-encoded sign-ins per account too", async () => {
    const form = await statuses(app, 4, () => ({
      contentType: "application/x-www-form-urlencoded",
      body: new URLSearchParams({
        email: "form@example.test",
        password: "wrong-password-123",
      }).toString(),
    }));
    expect(form[3]).toBe(429);
  });

  it("does not count the account's own correct sign-ins", async () => {
    const { email: victim } = await createPasswordUser(auth);
    const own = await statuses(app, 5, () => ({
      body: signInBody(victim, PASSWORD),
    }));
    expect(own).toEqual([200, 200, 200, 200, 200]);
  });

  it("fills the account's limit with failed sign-ins only", async () => {
    const { email: victim } = await createPasswordUser(auth);
    const wrong = () => attempt(app, { body: signInBody(victim) });
    const right = () => attempt(app, { body: signInBody(victim, PASSWORD) });

    expect((await wrong()).status).toBe(401);
    expect((await wrong()).status).toBe(401);
    expect((await right()).status).toBe(200);
    expect((await right()).status).toBe(200);
    expect((await wrong()).status).toBe(401);
    // Three failures fill it, and a full limit refuses even the right password,
    // or guessing would be unlimited.
    expect((await right()).status).toBe(429);
  });

  it("counts parallel guesses before any of them answers", async () => {
    const { email: victim } = await createPasswordUser(auth);
    const burst = await Promise.all(
      Array.from({ length: 6 }, () =>
        attempt(app, { body: signInBody(victim) }),
      ),
    );
    const answered = burst.filter((response) => response.status !== 429);
    expect(answered).toHaveLength(3);
  });

  it("counts successful requests outside credential checks", async () => {
    // Mail-sending paths work the same way; the tests have no SMTP server.
    const cookie = await signInCookie(
      app,
      auth,
      (await createPasswordUser(auth)).email,
    );
    const reads = await statuses(app, 101, () => ({
      path: "/api/auth/get-session",
      body: undefined,
      cookie,
    }));
    expect(reads.slice(0, 100).every((status) => status === 200)).toBe(true);
    expect(reads[100]).toBe(429);
  });

  it("ignores extra cookies when counting two-factor attempts", async () => {
    const pending = await pendingSignInCookie(
      auth,
      (await createPasswordUser(auth)).userId,
    );
    let junk = 0;
    const guesses = await statuses(app, 4, () => ({
      path: "/api/auth/two-factor/verify-totp",
      body: JSON.stringify({ code: "000000" }),
      cookie: `${pending}; junk=${junk++}`,
    }));
    expect(guesses[3]).toBe(429);

    const otherSignIn = await attempt(app, {
      path: "/api/auth/two-factor/verify-totp",
      body: JSON.stringify({ code: "000000" }),
      cookie: await pendingSignInCookie(
        auth,
        (await createPasswordUser(auth)).userId,
      ),
    });
    expect(otherSignIn.status).not.toBe(429);
  });

  it.each([
    ["unsigned", false],
    ["signed but unknown", true],
  ])("counts %s session cookies in the shared limit", async (_kind, sign) => {
    const context = await auth.$context;
    const sessionCookie = context.authCookies.sessionToken.name;
    const tokens: string[] = [];
    for (let i = 0; i < 4; i++) {
      const token = `made-up-${randomUUID()}`;
      tokens.push(sign ? await signed(auth, token) : `${token}.c2lnbmF0dXJl`);
    }
    const guesses = await statuses(app, 4, () => ({
      path: "/api/auth/two-factor/generate-backup-codes",
      body: JSON.stringify({ password: "x", code: "000000" }),
      cookie: `${sessionCookie}=${tokens.shift()}`,
    }));
    expect(guesses[3]).toBe(429);
  });

  it("counts every session of one user as one account", async () => {
    const { email } = await createPasswordUser(auth);
    const sessions = [
      await signInCookie(app, auth, email),
      await signInCookie(app, auth, email),
    ];
    let n = 0;
    const guesses = await statuses(app, 4, () => ({
      path: "/api/auth/two-factor/generate-backup-codes",
      body: JSON.stringify({ password: "wrong-password-123", code: "000000" }),
      cookie: sessions[n++ % 2],
    }));
    expect(guesses[3]).toBe(429);
  });

  it.each(["/api/auth/sign-up/email", "/api/auth/sign-in/anonymous"])(
    "keeps %s limited when each request brings another cookie",
    async (path) => {
      const context = await auth.$context;
      const sessionCookie = context.authCookies.sessionToken.name;
      let n = 0;
      let lastIssued = "";
      const results: number[] = [];
      for (let i = 0; i < 4; i++) {
        // Alternate made-up cookies with the real one the last success set.
        const cookie =
          i % 2 && lastIssued
            ? lastIssued
            : `${sessionCookie}=${await signed(auth, `rotated-${n++}`)}; junk=${n}`;
        const response = await attempt(app, {
          path,
          cookie,
          body: JSON.stringify({
            email: `new-${randomUUID()}@example.test`,
            password: PASSWORD,
            name: "New Person",
          }),
        });
        results.push(response.status);
        const issued = response.headers
          .getSetCookie()
          .find((value) => value.startsWith(`${sessionCookie}=`));
        if (issued) lastIssued = issued.split(";")[0] ?? "";
      }
      expect(results[3]).toBe(429);
    },
  );

  it("charges the session when each request names another email", async () => {
    const session = await signInCookie(
      app,
      auth,
      (await createPasswordUser(auth)).email,
    );
    let n = 0;
    const guesses = await statuses(app, 4, () => ({
      path: "/api/auth/two-factor/generate-backup-codes",
      body: JSON.stringify({
        password: "wrong-password-123",
        code: "000000",
        email: `rotated-${n++}@example.test`,
      }),
      cookie: session,
    }));
    expect(guesses[3]).toBe(429);
  });

  it("charges the pending sign-in when the session cookie changes", async () => {
    const context = await auth.$context;
    const sessionCookie = context.authCookies.sessionToken.name;
    const pending = await pendingSignInCookie(
      auth,
      (await createPasswordUser(auth)).userId,
    );
    let n = 0;
    const guesses = await statuses(app, 4, () => ({
      path: "/api/auth/two-factor/verify-totp",
      body: JSON.stringify({ code: "000000" }),
      cookie: `${pending}; ${sessionCookie}=${n++ % 2 ? `junk-${n}` : `${randomUUID()}.c2ln`}`,
    }));
    expect(guesses[3]).toBe(429);
  });

  it("counts invitations per inviter, not per invitee", async () => {
    const inviter = await signInCookie(
      app,
      auth,
      (await createPasswordUser(auth)).email,
    );
    let n = 0;
    const invites = await statuses(app, 6, () => ({
      path: "/api/auth/organization/invite-member",
      body: JSON.stringify({
        email: `invitee-${n++}@example.test`,
        role: "member",
      }),
      cookie: inviter,
    }));
    expect(invites.slice(0, 5)).not.toContain(429);
    expect(invites[5]).toBe(429);
  });

  it("warns once when requests arrive through a proxy", async () => {
    const { app: fresh } = await load(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await attempt(fresh, { body: signInBody("direct@example.test") });
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining("TRUSTED_PROXIES"),
      );
      for (let i = 0; i < 2; i++) {
        await attempt(fresh, {
          forwardedFor: "198.51.100.9",
          body: signInBody(`proxied-${i}@example.test`),
        });
      }
      const proxyWarnings = warn.mock.calls.filter(([message]) =>
        String(message).includes("TRUSTED_PROXIES"),
      );
      expect(proxyWarnings).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps the shared limit for requests that name no account", async () => {
    const anonymous = await statuses(app, 4, () => ({
      path: "/api/auth/sign-in/social",
      body: JSON.stringify({ provider: "github" }),
    }));
    expect(anonymous[3]).toBe(429);
  });
});

describe("auth rate limits with TRUSTED_PROXIES set", () => {
  let app: App;

  beforeAll(async () => {
    ({ app } = await load(`127.0.0.0/8,::1/128,${PROXY}/32`));
  });

  it("counts per client address forwarded by the trusted proxy", async () => {
    let n = 0;
    const client = await statuses(app, 4, () => ({
      forwardedFor: "198.51.100.7",
      body: signInBody(`client-${n++}@example.test`),
    }));
    expect(client.slice(0, 3)).not.toContain(429);
    expect(client[3]).toBe(429);

    const otherClient = await attempt(app, {
      forwardedFor: "198.51.100.8",
      body: signInBody("client-0@example.test"),
    });
    expect(otherClient.status).not.toBe(429);
  });
});
