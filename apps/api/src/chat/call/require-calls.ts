import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { logCallsOffOnce, readCallConfig } from "./call-config";

// Runs before the access checks, so a server without calls answers every call
// route like a missing one.
export const requireCalls = createMiddleware(async (_c, next) => {
  if (!readCallConfig()) {
    logCallsOffOnce();
    throw new HTTPException(404, { message: "Calls are off on this server" });
  }
  await next();
});
