import { HTTPException } from "hono/http-exception";
import type { DbOrTx } from "../project-access/db-or-tx";
import { isWorkspaceGuest } from "./is-workspace-guest";

// A guest's role and reach come with their invitation. Widening them means
// removing the guest and inviting them again as a member.
export async function assertNotGuest(
  workspaceId: string,
  userId: string,
  database: DbOrTx,
) {
  if (await isWorkspaceGuest(workspaceId, userId, database)) {
    throw new HTTPException(409, {
      message:
        "A guest keeps their role. Remove them and invite them again as a member.",
    });
  }
}
