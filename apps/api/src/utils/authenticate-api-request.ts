import * as Sentry from "@sentry/node";
import { APIError } from "better-auth/api";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { resolveInternalUser } from "../agent/internal-auth";
import { scopedSessionAllows } from "../mcp/scope";
import { apiKeyRejection } from "./api-key-rejection";
import { getUserSession } from "./get-user-session";
import { type ApiKeyRateLimit, rateLimitHeaders } from "./rate-limit-headers";
import { verifyApiKey } from "./verify-api-key";

// User is tagged on Sentry's isolation scope; the per-request isolation
// scope is forked by Sentry.withIsolationScope in the api.use("*", ...)
// middleware, so this only affects the in-flight request.
function attachUserToScope(userId: string) {
  Sentry.setUser({ id: userId });
}

function isAuthRejection(error: unknown) {
  if (!(error instanceof APIError)) {
    return false;
  }
  const status = typeof error.statusCode === "number" ? error.statusCode : 0;
  return status >= 400 && status < 500;
}

async function getSession(headers: Headers) {
  try {
    return await getUserSession(headers);
  } catch (error) {
    if (isAuthRejection(error)) {
      return null;
    }
    throw error;
  }
}

async function getSessionFromBearerOnlyHeaders(c: Context) {
  const headers = new Headers(c.req.raw.headers);
  headers.delete("cookie");

  return getSession(headers);
}

function parseBearerToken(authHeader: string | undefined): {
  token: string | null;
  malformed: boolean;
} {
  if (!authHeader) {
    return { token: null, malformed: false };
  }

  if (!authHeader.match(/^Bearer\b/i)) {
    return { token: null, malformed: false };
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return { token: null, malformed: true };
  }

  return {
    token: match[1] ?? null,
    malformed: false,
  };
}

// Keyed on the session row, not on how it arrived: the same token is a
// bearer token or, signed, a cookie. Any value at all limits the session, so
// a scope this build does not know is never read as full access.
function assertSessionScope(
  c: Context,
  session: { mcpScope?: string | null } | null | undefined,
) {
  if (session?.mcpScope && !scopedSessionAllows(c.req.method, c.req.path)) {
    throw new HTTPException(403, {
      message: "This connection can only change documents and topics",
    });
  }
}

function setRateLimitHeaders(c: Context, rateLimit: ApiKeyRateLimit | null) {
  if (rateLimit) c.set("apiKeyHeaders", rateLimitHeaders(rateLimit));
}

type VerifiedApiKey = Extract<
  Awaited<ReturnType<typeof verifyApiKey>>,
  { status: "valid" }
>;

function setApiKeyContext(c: Context, { key, rateLimit }: VerifiedApiKey) {
  c.set("userId", key.userId);
  c.set("userEmail", "");
  c.set("user", null);
  c.set("session", null);
  c.set("apiKey", {
    id: key.id,
    userId: key.userId,
    enabled: key.enabled,
    permissions: key.permissions,
  });
  setRateLimitHeaders(c, rateLimit);
  attachUserToScope(key.userId);
}

export async function authenticateApiRequest(c: Context): Promise<void> {
  const internalUserId = await resolveInternalUser(c.req.raw);
  if (internalUserId === "invalid") {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  if (internalUserId) {
    c.set("userId", internalUserId);
    c.set("userEmail", "");
    c.set("user", null);
    c.set("session", null);
    attachUserToScope(internalUserId);
    return;
  }

  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const apiKeyHeader = c.req.header("x-api-key")?.trim();
  if (!token && apiKeyHeader) {
    const apiKeyResult = await verifyApiKey(apiKeyHeader);
    if (apiKeyResult?.status !== "valid") {
      throw apiKeyRejection(apiKeyResult);
    }
    setApiKeyContext(c, apiKeyResult);
    return;
  }

  if (token) {
    const apiKeyResult = await verifyApiKey(token);
    if (apiKeyResult?.status === "valid") {
      setApiKeyContext(c, apiKeyResult);
      return;
    }
    if (apiKeyResult) {
      throw apiKeyRejection(apiKeyResult);
    }
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);
    if (sessionResult?.user && sessionResult.session) {
      assertSessionScope(c, sessionResult.session);
      c.set("user", sessionResult.user);
      c.set("session", sessionResult.session);
      c.set("userId", sessionResult.user.id);
      c.set("userEmail", sessionResult.user.email ?? "");
      attachUserToScope(sessionResult.user.id);
      return;
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionResult = await getSession(c.req.raw.headers);
  c.set("user", sessionResult?.user ?? null);
  c.set("session", sessionResult?.session ?? null);
  c.set("userId", sessionResult?.user?.id ?? "");
  c.set("userEmail", sessionResult?.user?.email ?? "");

  if (!sessionResult?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  assertSessionScope(c, sessionResult.session);

  attachUserToScope(sessionResult.user.id);
}

/**
 * For the /auth routes, which the provider answers itself. True when either
 * credential on the request, read on its own, is a session limited to
 * documents and the request is not one such a session may send.
 */
export async function isRefusedForScopedSession(c: Context): Promise<boolean> {
  if (scopedSessionAllows(c.req.method, c.req.path)) return false;
  const raw = c.req.raw.headers;
  for (const drop of ["cookie", "authorization"]) {
    const kept = drop === "cookie" ? "authorization" : "cookie";
    if (!raw.get(kept)) continue;
    const headers = new Headers(raw);
    headers.delete(drop);
    if ((await getSession(headers))?.session.mcpScope) return true;
  }
  return false;
}

export async function resolveAssetBearerOrCookie(c: Context): Promise<{
  userId: string;
  apiKeyId?: string;
  apiKeyPermissions?: Record<string, string[]> | null;
}> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const apiKeyHeader = c.req.header("x-api-key")?.trim();
  if (!token && apiKeyHeader) {
    const apiKeyResult = await verifyApiKey(apiKeyHeader);
    if (apiKeyResult?.status !== "valid") {
      throw apiKeyRejection(apiKeyResult);
    }
    setRateLimitHeaders(c, apiKeyResult.rateLimit);
    return {
      userId: apiKeyResult.key.userId,
      apiKeyId: apiKeyResult.key.id,
      apiKeyPermissions: apiKeyResult.key.permissions,
    };
  }

  if (token) {
    const apiKeyResult = await verifyApiKey(token);
    if (apiKeyResult?.status === "valid") {
      setRateLimitHeaders(c, apiKeyResult.rateLimit);
      return {
        userId: apiKeyResult.key.userId,
        apiKeyId: apiKeyResult.key.id,
        apiKeyPermissions: apiKeyResult.key.permissions,
      };
    }
    if (apiKeyResult) {
      throw apiKeyRejection(apiKeyResult);
    }
    const sessionResult = await getSessionFromBearerOnlyHeaders(c);
    if (sessionResult?.user?.id) {
      return { userId: sessionResult.user.id };
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const sessionResult = await getSession(c.req.raw.headers);
  if (!sessionResult?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return { userId: sessionResult.user.id };
}
