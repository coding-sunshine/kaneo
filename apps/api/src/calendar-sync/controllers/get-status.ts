import { getCalendarOAuthClient } from "../config";
import { listConnections } from "../connection";
import { CALENDAR_PROVIDERS } from "../providers/types";

export async function getStatus(userId: string) {
  const rows = await listConnections(userId);
  return {
    providers: CALENDAR_PROVIDERS.map((provider) => {
      const row = rows.find((candidate) => candidate.provider === provider);
      const state = !getCalendarOAuthClient(provider)
        ? "not_configured"
        : !row
          ? "not_connected"
          : row.accessToken
            ? "connected"
            : "needs_reconnect";
      return {
        provider,
        state,
        email: state === "connected" ? (row?.accountEmail ?? null) : null,
      } as const;
    }),
  };
}
