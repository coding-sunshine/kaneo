import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { workspaceAccess } from "../utils/workspace-access-middleware";

export const chatFileRefused = () =>
  new HTTPException(403, { message: "No access to this channel" });

const workspaceFromParam = workspaceAccess.fromParam();

// A chat file URL refuses everyone who cannot read its channel with the same
// 403, so it tells nobody which workspaces or channels exist. People outside
// the workspace get that 403 here, before the channel rules run.
export async function chatFileWorkspaceAccess(c: Context, next: Next) {
  try {
    await workspaceFromParam(c, async () => {});
  } catch (error) {
    if (error instanceof HTTPException && error.status === 404) {
      throw chatFileRefused();
    }
    throw error;
  }
  return next();
}
