import { and, eq } from "drizzle-orm";
import db from "../database";
import { calendarConnectionTable } from "../database/schema";
import { getCalendarOAuthClient } from "./config";
import { CalendarApiError } from "./providers/http";
import { calendarProviders } from "./providers";
import type { CalendarProviderId, TokenSet } from "./providers/types";

const EXPIRY_SKEW_MS = 60_000;

export type CalendarConnectionRow = typeof calendarConnectionTable.$inferSelect;

const own = (userId: string, provider: CalendarProviderId) =>
  and(
    eq(calendarConnectionTable.userId, userId),
    eq(calendarConnectionTable.provider, provider),
  );

export async function saveConnection(
  userId: string,
  provider: CalendarProviderId,
  token: TokenSet,
  accountEmail: string | null,
  timeZone: string,
) {
  const values = {
    accountEmail,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    accessTokenExpiresAt: token.expiresAt,
    timeZone,
    updatedAt: new Date(),
  };
  await db
    .insert(calendarConnectionTable)
    .values({ userId, provider, ...values })
    .onConflictDoUpdate({
      target: [
        calendarConnectionTable.userId,
        calendarConnectionTable.provider,
      ],
      set: values,
    });
}

export function listConnections(userId: string) {
  return db
    .select()
    .from(calendarConnectionTable)
    .where(eq(calendarConnectionTable.userId, userId));
}

export async function findConnection(
  userId: string,
  provider: CalendarProviderId,
) {
  const [row] = await db
    .select()
    .from(calendarConnectionTable)
    .where(own(userId, provider));
  return row ?? null;
}

/** Keeps the row so the page can offer "Reconnect" instead of "Connect". */
export function markConnectionDead(connectionId: string) {
  return db
    .update(calendarConnectionTable)
    .set({ accessToken: null, refreshToken: null, updatedAt: new Date() })
    .where(eq(calendarConnectionTable.id, connectionId));
}

/**
 * The connection's usable access token, refreshed when expired, or null once
 * the person must reconnect. The refresh runs under a row lock because
 * Microsoft rotates refresh tokens: two refreshes would void each other.
 */
export function resolveAccessToken(connectionId: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(calendarConnectionTable)
      .where(eq(calendarConnectionTable.id, connectionId))
      .for("update");
    if (!row?.accessToken) return null;
    const expires = row.accessTokenExpiresAt?.getTime();
    if (!expires || expires - EXPIRY_SKEW_MS > Date.now()) {
      return row.accessToken;
    }
    const client = getCalendarOAuthClient(row.provider);
    if (!client || !row.refreshToken) return null;
    try {
      const next = await calendarProviders[row.provider].refresh(
        client,
        row.refreshToken,
      );
      await tx
        .update(calendarConnectionTable)
        .set({
          accessToken: next.accessToken,
          // Google omits the refresh token on refresh: keep the stored one.
          refreshToken: next.refreshToken ?? row.refreshToken,
          accessTokenExpiresAt: next.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(calendarConnectionTable.id, row.id));
      return next.accessToken;
    } catch (error) {
      if (!(error instanceof CalendarApiError) || error.status !== 401) {
        throw error;
      }
      await tx
        .update(calendarConnectionTable)
        .set({ accessToken: null, refreshToken: null })
        .where(eq(calendarConnectionTable.id, row.id));
      return null;
    }
  });
}

/** Runs a provider call with the connection's token; a 401 marks it dead. */
export async function withCalendarToken<T>(
  connection: Pick<CalendarConnectionRow, "id">,
  call: (token: string) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false }> {
  const token = await resolveAccessToken(connection.id);
  if (!token) return { ok: false };
  try {
    return { ok: true, value: await call(token) };
  } catch (error) {
    if (error instanceof CalendarApiError && error.status === 401) {
      await markConnectionDead(connection.id);
      return { ok: false };
    }
    throw error;
  }
}
