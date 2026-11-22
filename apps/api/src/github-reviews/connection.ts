import { and, eq, sql } from "drizzle-orm";
import db from "../database";
import { accountTable } from "../database/schema";
import { getReviewsOAuthConfig } from "./config";
import {
  GithubApiError,
  type GithubTokenResponse,
  refreshAccessToken,
} from "./github-api";

// A distinct provider id: a "github" row would become a sign-in method
// if GitHub SSO is ever enabled.
export const REVIEWS_PROVIDER = "github-reviews";
const EXPIRY_SKEW_MS = 60_000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ownRows = (userId: string) =>
  and(
    eq(accountTable.userId, userId),
    eq(accountTable.providerId, REVIEWS_PROVIDER),
  );

// account has no unique key on (user_id, provider_id), so serialize writers.
const lockUser = (tx: Tx, userId: string) =>
  tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`${REVIEWS_PROVIDER}:${userId}`}))`,
  );

export function saveConnection(
  userId: string,
  githubUserId: number,
  token: GithubTokenResponse,
) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    await tx.delete(accountTable).where(ownRows(userId));
    await tx.insert(accountTable).values({
      userId,
      providerId: REVIEWS_PROVIDER,
      accountId: String(githubUserId),
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      scope: token.scope,
      updatedAt: new Date(),
    });
  });
}

export function deleteConnection(userId: string) {
  return db.delete(accountTable).where(ownRows(userId));
}

/** Keeps the row so the page can offer "Reconnect" instead of "Connect". */
export function markConnectionDead(userId: string) {
  return db
    .update(accountTable)
    .set({ accessToken: null, refreshToken: null })
    .where(ownRows(userId));
}

export type Connection =
  | { state: "not_connected" | "needs_reconnect" }
  | { state: "connected"; token: string };

/** The user's usable token, refreshed when expired. */
export function resolveConnection(userId: string): Promise<Connection> {
  return db.transaction(async (tx) => {
    // Refresh tokens rotate, so concurrent requests must not both refresh.
    // ponytail: the GitHub call runs under the row lock; fine per user.
    await lockUser(tx, userId);
    const [row] = await tx.select().from(accountTable).where(ownRows(userId));
    if (!row) return { state: "not_connected" };
    if (!row.accessToken) return { state: "needs_reconnect" };

    const expires = row.accessTokenExpiresAt?.getTime();
    if (!expires || expires - EXPIRY_SKEW_MS > Date.now()) {
      return { state: "connected", token: row.accessToken };
    }

    const config = getReviewsOAuthConfig();
    const refreshExpires = row.refreshTokenExpiresAt?.getTime();
    if (
      !config ||
      !row.refreshToken ||
      (refreshExpires && refreshExpires < Date.now())
    ) {
      return { state: "needs_reconnect" };
    }
    try {
      const next = await refreshAccessToken(config, row.refreshToken);
      await tx
        .update(accountTable)
        .set({
          accessToken: next.accessToken,
          refreshToken: next.refreshToken,
          accessTokenExpiresAt: next.accessTokenExpiresAt,
          refreshTokenExpiresAt: next.refreshTokenExpiresAt,
          scope: next.scope ?? row.scope,
        })
        .where(eq(accountTable.id, row.id));
      return { state: "connected", token: next.accessToken };
    } catch (error) {
      if (!(error instanceof GithubApiError) || error.status >= 500)
        throw error;
      await tx
        .update(accountTable)
        .set({ accessToken: null, refreshToken: null })
        .where(eq(accountTable.id, row.id));
      return { state: "needs_reconnect" };
    }
  });
}
