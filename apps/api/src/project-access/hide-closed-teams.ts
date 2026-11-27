import type { HTTPException } from "hono/http-exception";
import { findInaccessibleProjectIds } from "./find-inaccessible-project-ids";

// A team the caller cannot open gets the answer an unknown team gets, so a
// refusal never confirms the team is there. `unknown` is that answer.
export async function hideClosedTeams(
  userId: string,
  projectIds: string | readonly string[],
  unknown: () => HTTPException,
): Promise<void> {
  const ids = typeof projectIds === "string" ? [projectIds] : projectIds;
  if ((await findInaccessibleProjectIds(userId, ids)).length > 0) {
    throw unknown();
  }
}
