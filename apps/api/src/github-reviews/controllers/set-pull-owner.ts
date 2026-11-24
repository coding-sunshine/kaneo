import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  pullRequestOwnerTable,
  workspaceUserTable,
} from "../../database/schema";
import { getPull } from "../github-api";
import { withGithubToken } from "../with-github-token";

export async function setPullRequestOwner(
  userId: string,
  owner: string,
  repo: string,
  number: string,
  workspaceId: string,
  ownerUserId: string | null,
) {
  const pull = await withGithubToken(userId, (token) =>
    getPull(token, owner, repo, number),
  );
  const url = pull.html_url;

  if (ownerUserId === null) {
    await db
      .delete(pullRequestOwnerTable)
      .where(
        and(
          eq(pullRequestOwnerTable.workspaceId, workspaceId),
          eq(pullRequestOwnerTable.url, url),
        ),
      );
    return { ok: true as const };
  }

  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, ownerUserId),
      ),
    )
    .limit(1);
  if (!member) {
    throw new HTTPException(400, {
      message: "The owner must be a member of the workspace",
    });
  }

  await db
    .insert(pullRequestOwnerTable)
    .values({ workspaceId, url, ownerUserId })
    .onConflictDoUpdate({
      target: [pullRequestOwnerTable.workspaceId, pullRequestOwnerTable.url],
      set: { ownerUserId },
    });
  return { ok: true as const };
}
