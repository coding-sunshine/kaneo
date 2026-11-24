import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import {
  accountTable,
  pullRequestOwnerTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { REVIEWS_PROVIDER } from "./connection";
import { type OwnerMember, toReviewOwner } from "./review-owner";

const NO_OWNER = toReviewOwner(undefined, undefined);

const memberOf = (workspaceId: string) =>
  eq(workspaceUserTable.workspaceId, workspaceId);

/** Review owners for pull requests in one workspace; empty unless the caller belongs to it. */
export async function findReviewOwners(
  userId: string,
  workspaceId: string | undefined,
  pulls: { url: string; authorGithubId: number | null }[],
) {
  const owners = new Map<string, ReturnType<typeof toReviewOwner>>();
  const forPull = (url: string) => owners.get(url) ?? NO_OWNER;
  if (!workspaceId || pulls.length === 0) return forPull;

  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(and(memberOf(workspaceId), eq(workspaceUserTable.userId, userId)))
    .limit(1);
  if (!membership) return forPull;

  const urls = [...new Set(pulls.map((pull) => pull.url))];
  const githubIds = [
    ...new Set(pulls.flatMap((pull) => pull.authorGithubId ?? [])),
  ].map(String);

  const saved = await db
    .select({
      url: pullRequestOwnerTable.url,
      userId: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(pullRequestOwnerTable)
    .innerJoin(userTable, eq(userTable.id, pullRequestOwnerTable.ownerUserId))
    .innerJoin(
      workspaceUserTable,
      and(
        memberOf(workspaceId),
        eq(workspaceUserTable.userId, pullRequestOwnerTable.ownerUserId),
      ),
    )
    .where(
      and(
        eq(pullRequestOwnerTable.workspaceId, workspaceId),
        inArray(pullRequestOwnerTable.url, urls),
      ),
    );
  const authors =
    githubIds.length === 0
      ? []
      : await db
          .select({
            githubId: accountTable.accountId,
            userId: userTable.id,
            name: userTable.name,
            image: userTable.image,
          })
          .from(accountTable)
          .innerJoin(userTable, eq(userTable.id, accountTable.userId))
          .innerJoin(
            workspaceUserTable,
            and(
              memberOf(workspaceId),
              eq(workspaceUserTable.userId, accountTable.userId),
            ),
          )
          .where(
            and(
              inArray(accountTable.providerId, [REVIEWS_PROVIDER, "github"]),
              inArray(accountTable.accountId, githubIds),
            ),
          );

  const savedByUrl = new Map<string, OwnerMember>(
    saved.map(({ url, ...member }) => [url, member]),
  );
  const authorByGithubId = new Map<string, OwnerMember>(
    authors.map(({ githubId, ...member }) => [githubId, member]),
  );
  for (const pull of pulls) {
    owners.set(
      pull.url,
      toReviewOwner(
        savedByUrl.get(pull.url),
        pull.authorGithubId === null
          ? undefined
          : authorByGithubId.get(String(pull.authorGithubId)),
      ),
    );
  }
  return forPull;
}
