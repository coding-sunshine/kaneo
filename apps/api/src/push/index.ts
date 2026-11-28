import type { z } from "zod";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { registerDevice, unregisterDevice } from "./devices";
import {
  registerDeviceBody,
  registeredDeviceSchema,
  unregisterDeviceBody,
  unregisteredDeviceSchema,
} from "./schema";
import { pushSender } from "./senders";
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
  summary: "Register a phone for chat pushes",
  description:
    "Store this app install's native push token for your sign-in, so new chat messages reach the phone. Signing out or revoking the session drops it. Requires a user session; API keys are rejected.",
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
  summary: "Stop chat pushes to a phone",
  description:
    "Forget one of your push tokens. Another person's token is left alone.",
  middleware: [requireUserSession] as const,
  request: { body: body(unregisterDeviceBody) },
  responses: {
    200: jsonResponse("Removed", unregisteredDeviceSchema),
    401: unauthorized,
    403: sessionOnly,
  },
});

const push = apiRouter()
  .openapi(registerRoute, async (c) => {
    const { platform, token } = c.req.valid("json");
    await registerDevice({
      userId: c.get("userId"),
      sessionId: c.get("session")?.id ?? "",
      platform,
      token,
    });
    return c.json({ delivering: pushSender(platform) !== null }, 200);
  })
  .openapi(unregisterRoute, async (c) =>
    c.json(
      {
        removed: await unregisterDevice(
          c.get("userId"),
          c.req.valid("json").token,
        ),
      },
      200,
    ),
  );

export default push;
