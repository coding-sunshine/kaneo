import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";

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
  return app.request(
    options.path ?? "/api/auth/sign-in/email",
    { method: "POST", headers, body: options.body ?? "{}" },
    { incoming: { socket: { remoteAddress: PROXY } } },
  );
}

const signInBody = (email: string) =>
  JSON.stringify({ email, password: "wrong-password-123" });

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

  it("ignores extra cookies when counting two-factor attempts", async () => {
    const context = await auth.$context;
    const twoFactorCookie = context.createAuthCookie("two_factor").name;
    let junk = 0;
    const guesses = await statuses(app, 4, () => ({
      path: "/api/auth/two-factor/verify-totp",
      body: JSON.stringify({ code: "000000" }),
      cookie: `${twoFactorCookie}=pending-sign-in; junk=${junk++}`,
    }));
    expect(guesses[3]).toBe(429);

    const otherSignIn = await attempt(app, {
      path: "/api/auth/two-factor/verify-totp",
      body: JSON.stringify({ code: "000000" }),
      cookie: `${twoFactorCookie}=another-sign-in`,
    });
    expect(otherSignIn.status).not.toBe(429);
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
