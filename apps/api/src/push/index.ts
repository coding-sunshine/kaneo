import type { z } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { registerDevice, unregisterDevice } from "./devices";
import { logPushOffOnce } from "./push-config";
import {
  registerDeviceBody,
  registeredDeviceSchema,
  unregisterDeviceBody,
  unregisteredDeviceSchema,
  webPushKeySchema,
} from "./schema";
import { pushSender } from "./senders";
import { readVapidConfig } from "./vapid-config";
import { webPushToken } from "./web-push-token";
import "./subscribe";

const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});
const tags = ["Push"];
const unauthorized = errorResponse("Unauthorized");
const sessionOnly = errorResponse("Authenticated with an API key");

const registerRoute = createRoute({
  method: "put",
  operationId: "registerPushDevice",
  path: "/device",
  tags,
  summary: "Register a phone or browser for chat pushes",
  description:
    "Store this app install's native push token, or this browser's push subscription, for your sign-in, so chat messages reach the device. Signing out or revoking the session drops it. Requires a user session; API keys are rejected.",
  middleware: [requireUserSession] as const,
  request: { body: body(registerDeviceBody) },
  responses: {
    200: jsonResponse("Registered", registeredDeviceSchema),
    401: unauthorized,
    403: sessionOnly,
  },
});

const unregisterRoute = createRoute({
  method: "delete",
  operationId: "unregisterPushDevice",
  path: "/device",
  tags,
  summary: "Stop chat pushes to a phone or browser",
  description:
    "Forget one of your push tokens or browser subscriptions. Another person's is left alone.",
  middleware: [requireUserSession] as const,
  request: { body: body(unregisterDeviceBody) },
  responses: {
    200: jsonResponse("Removed", unregisteredDeviceSchema),
    401: unauthorized,
    403: sessionOnly,
  },
});

const webKeyRoute = createRoute({
  method: "get",
  operationId: "getWebPushKey",
  path: "/web-key",
  tags,
  summary: "Get the key a browser subscribes to desktop pushes with",
  description:
    "The server's VAPID public key, or null while desktop push is off. Requires a user session.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse("The key", webPushKeySchema),
    401: unauthorized,
    403: sessionOnly,
  },
});

const push = apiRouter()
  .openapi(registerRoute, async (c) => {
    const body = c.req.valid("json");
    await registerDevice({
      userId: c.get("userId"),
      sessionId: c.get("session")?.id ?? "",
      platform: body.platform,
      token:
        body.platform === "web" ? webPushToken(body.subscription) : body.token,
    });
    return c.json({ delivering: pushSender(body.platform) !== null }, 200);
  })
  .openapi(unregisterRoute, async (c) => {
    const body = c.req.valid("json");
    const token =
      "token" in body ? body.token : webPushToken(body.subscription);
    return c.json(
      { removed: await unregisterDevice(c.get("userId"), token) },
      200,
    );
  })
  .openapi(webKeyRoute, (c) => {
    const publicKey = readVapidConfig()?.publicKey ?? null;
    if (!publicKey) logPushOffOnce("web");
    return c.json({ publicKey }, 200);
  });

export default push;
