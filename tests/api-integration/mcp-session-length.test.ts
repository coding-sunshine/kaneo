import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  createAuthorizationRequest,
  registerClient,
} from "../../apps/api/src/mcp/oauth";
import enUS from "../../i18n/en-US.json";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { callWhoami, serveForMcpTools } from "./helpers/mcp-http";

const redirectUri = "https://client.example/callback";
const verifier = "mcp-session-length-test-verifier";
const origin = "http://localhost:5173";
const email = "session-length@example.com";
const day = 24 * 60 * 60 * 1000;
const slack = 60 * 1000;

type App = ReturnType<typeof createApp>["app"];

let close: (() => Promise<void>) | undefined;

// Consent and redeem the code through the app, as an MCP client would.
async function connect(app: App) {
  const user = await signUpWithSession(app, { email, name: "Session Length" });
  const client = await registerClient({ redirectUris: [redirectUri] });
  const requestId = await createAuthorizationRequest({
    clientId: client.clientId,
    redirectUri,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  const decision = await app.request(
    `/api/mcp/authorize/request/${requestId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        cookie: user.cookies,
      },
      body: JSON.stringify({ approved: true }),
    },
  );
  expect(decision.status).toBe(200);
  const { redirect } = (await decision.json()) as { redirect: string };
  const response = await app.request("/api/mcp/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: new URL(redirect).searchParams.get("code") ?? "",
      client_id: client.clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

async function expiresAt(token: string) {
  const [row] = await db
    .select({ expiresAt: schema.sessionTable.expiresAt })
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.token, token));
  return row?.expiresAt.getTime();
}

function setExpiresAt(token: string, at: number) {
  return db
    .update(schema.sessionTable)
    .set({ expiresAt: new Date(at) })
    .where(eq(schema.sessionTable.token, token));
}

async function setup() {
  const { app } = createApp();
  const served = await serveForMcpTools(app);
  close = served.close;
  return { base: served.base, token: await connect(app) };
}

const copy = enUS.auth.mcp.authorize.durationValue;

describe("API integration: MCP connection length", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it("issues a 30-day connection that use does not move while most of it remains", async () => {
    const { base, token } = await setup();
    const issued = await expiresAt(token.access_token);

    expect(token.expires_in).toBe(30 * 24 * 60 * 60);
    expect(Math.abs((issued ?? 0) - (Date.now() + 30 * day))).toBeLessThan(
      slack,
    );
    expect(copy).toContain(`${token.expires_in / (24 * 60 * 60)} days`);

    const result = await callWhoami(base, token.access_token);
    expect(result.body).toContain(email);
    expect(await expiresAt(token.access_token)).toBe(issued);
  });

  it("keeps a connection in use past its issued 30 days, 7 days at a time, and ends it after a week unused", async () => {
    const { base, token } = await setup();
    // Only expires_at decides refresh, so moving it back by N days is the
    // same as N days passing.
    const elapse = async (days: number) =>
      setExpiresAt(
        token.access_token,
        ((await expiresAt(token.access_token)) ?? 0) - days * day,
      );
    const nearNowPlus = (at: number | undefined, days: number) =>
      expect(Math.abs((at ?? 0) - (Date.now() + days * day))).toBeLessThan(
        slack,
      );

    // Day 29: one day of the issued window left. Use renews it for 7 days.
    await elapse(29);
    expect((await callWhoami(base, token.access_token)).body).toContain(email);
    nearNowPlus(await expiresAt(token.access_token), 7);
    expect(copy).toContain("7 days");

    // Day 31: past the issued 30 days. It still answers and renews again.
    await elapse(2);
    expect((await callWhoami(base, token.access_token)).body).toContain(email);
    nearNowPlus(await expiresAt(token.access_token), 7);

    // Day 39: eight days without use. It is refused and not renewed.
    await elapse(8);
    const stale = await expiresAt(token.access_token);
    const result = await callWhoami(base, token.access_token);
    expect(result.status).toBe(401);
    expect(result.body).not.toContain(email);
    const after = await expiresAt(token.access_token);
    expect(after === undefined || after === stale).toBe(true);
  });

  it("does not renew a connection with more than 6 days left", async () => {
    const { base, token } = await setup();
    const end = Date.now() + 6 * day + 10 * slack;
    await setExpiresAt(token.access_token, end);

    expect((await callWhoami(base, token.access_token)).body).toContain(email);
    expect(await expiresAt(token.access_token)).toBe(end);
  });

  it("refuses a connection past its expiry", async () => {
    const { base, token } = await setup();
    await setExpiresAt(token.access_token, Date.now() - slack);

    const result = await callWhoami(base, token.access_token);
    expect(result.status).toBe(401);
    expect(result.body).not.toContain(email);
  });
});
