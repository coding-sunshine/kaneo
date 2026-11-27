import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  activeSessionListSchema,
  revokedSessionsSchema,
} from "../sessions/response";
import { requireInstancePermission } from "./roles/require-instance-permission";
import { requireManageableUser } from "./roles/require-manageable-user";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import listUserApiKeys from "./controllers/list-user-api-keys";
import listUserSessions from "./controllers/list-user-sessions";
import revokeUserApiKey from "./controllers/revoke-user-api-key";
import revokeUserSession from "./controllers/revoke-user-session";
import revokeUserSessions from "./controllers/revoke-user-sessions";
import resetUserTwoFactor from "./controllers/reset-user-two-factor";
import { requireOwnTwoFactorCode } from "./require-own-two-factor-code";
import {
  adminApiKeyListSchema,
  adminRevokedApiKeySchema,
  adminTwoFactorResetBodySchema,
  adminTwoFactorResetSchema,
  adminUserApiKeyParam,
  adminUserParam,
  adminUserSessionParam,
} from "./user-security-schema";

const forbidden = errorResponse(
  "The caller lacks the instance permission or is authenticated with an API key",
);

const listSessionsRoute = createRoute({
  method: "get",
  operationId: "listAdminUserSessions",
  path: "/users/{userId}/sessions",
  tags: ["Admin"],
  summary: "List a user's sessions",
  description:
    "List a user's signed-in sessions with device, IP address, and activity. Tokens are never returned. `current` marks the administrator's own session. Requires the `users:sessions` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:sessions"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("Active sessions", activeSessionListSchema),
    403: forbidden,
    404: errorResponse("User not found"),
  },
});

const revokeSessionRoute = createRoute({
  method: "delete",
  operationId: "revokeAdminUserSession",
  path: "/users/{userId}/sessions/{sessionId}",
  tags: ["Admin"],
  summary: "Sign out one of a user's sessions",
  description:
    "End one session immediately, including its realtime connections, and record it in the audit log. The administrator's own current session can't be ended here; sign out instead. Requires the `users:sessions` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:sessions"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserSessionParam },
  responses: {
    200: jsonResponse("Session signed out", revokedSessionsSchema),
    403: forbidden,
    404: errorResponse("User or session not found"),
    409: errorResponse("The session is the administrator's current session"),
  },
});

const revokeSessionsRoute = createRoute({
  method: "delete",
  operationId: "revokeAdminUserSessions",
  path: "/users/{userId}/sessions",
  tags: ["Admin"],
  summary: "Sign out all of a user's sessions",
  description:
    "End every session of a user immediately, including realtime connections, and record it in the audit log. When administrators target themselves, their current session is kept. API keys keep working; revoke them separately. Requires the `users:sessions` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:sessions"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("Sessions signed out", revokedSessionsSchema),
    403: forbidden,
    404: errorResponse("User not found"),
  },
});

const listApiKeysRoute = createRoute({
  method: "get",
  operationId: "listAdminUserApiKeys",
  path: "/users/{userId}/api-keys",
  tags: ["Admin"],
  summary: "List a user's API keys",
  description:
    "List a user's API keys with their name, start, status, and dates. The key and its hash are never returned. Requires the `users:api_keys` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:api_keys"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("API keys, newest first", adminApiKeyListSchema),
    403: forbidden,
    404: errorResponse("User not found"),
  },
});

const revokeApiKeyRoute = createRoute({
  method: "delete",
  operationId: "revokeAdminUserApiKey",
  path: "/users/{userId}/api-keys/{apiKeyId}",
  tags: ["Admin"],
  summary: "Revoke a user's API key",
  description:
    "Delete a user's API key so it stops working immediately, and record it in the audit log. Requires the `users:api_keys` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:api_keys"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserApiKeyParam },
  responses: {
    200: jsonResponse("API key revoked", adminRevokedApiKeySchema),
    403: forbidden,
    404: errorResponse("User or API key not found"),
  },
});

const resetTwoFactorRoute = createRoute({
  method: "post",
  operationId: "resetAdminUserTwoFactor",
  path: "/users/{userId}/two-factor/reset",
  tags: ["Admin"],
  summary: "Reset a user's two-factor",
  description:
    "Turn off another user's two-factor sign-in, for example after they lost their device: their authenticator secret, recovery codes and remembered devices are removed, and the reset is recorded in the audit log. Sessions are kept. If the instance requires two-factor, the next sign-in asks them to set it up again. You must have two-factor on yourself and send a current code from your authenticator app or one of your recovery codes; a session alone is refused. Your own two-factor can't be reset here. Requires the `users:credentials` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:credentials"),
    requireManageableUser,
  ] as const,
  request: {
    params: adminUserParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: adminTwoFactorResetBodySchema },
      },
    },
  },
  responses: {
    200: jsonResponse("Two-factor is off", adminTwoFactorResetSchema),
    403: errorResponse(
      "The caller lacks the instance permission, uses an API key, has no two-factor of their own, or sent a missing or wrong code",
    ),
    404: errorResponse("User not found"),
    409: errorResponse("The user is the caller"),
    429: errorResponse(
      "Too many wrong codes from the caller; code entry is locked for 15 minutes",
    ),
  },
});

export const adminUserSecurityRoutes = apiRouter()
  .openapi(listSessionsRoute, async (c) =>
    c.json(
      await listUserSessions(
        c.req.valid("param").userId,
        c.get("session")?.id ?? null,
      ),
      200,
    ),
  )
  .openapi(revokeSessionRoute, async (c) =>
    c.json(
      await revokeUserSession(
        c.req.valid("param"),
        c.get("session")?.id ?? null,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(revokeSessionsRoute, async (c) =>
    c.json(
      await revokeUserSessions(
        c.req.valid("param").userId,
        c.get("session")?.id ?? null,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(listApiKeysRoute, async (c) =>
    c.json(await listUserApiKeys(c.req.valid("param").userId), 200),
  )
  .openapi(revokeApiKeyRoute, async (c) =>
    c.json(
      await revokeUserApiKey(c.req.valid("param"), adminAuditRequest(c)),
      200,
    ),
  )
  .openapi(resetTwoFactorRoute, async (c) => {
    await requireOwnTwoFactorCode(c, c.req.valid("json").code);
    return c.json(
      await resetUserTwoFactor(
        c.req.valid("param").userId,
        adminAuditRequest(c),
      ),
      200,
    );
  });
