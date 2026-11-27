import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { isWorkspaceGuest } from "./is-workspace-guest";

// For workspace-wide content a guest never sees. Runs after the workspace
// access middleware; answers like a missing resource.
export function refuseGuests() {
  return async (c: Context, next: Next) => {
    const workspaceId = c.get("workspaceId") as string | undefined;
    const userId = c.get("userId") as string | undefined;
    if (workspaceId && userId && (await isWorkspaceGuest(workspaceId, userId)))
      throw new HTTPException(404, { message: "Not found" });
    return next();
  };
}
