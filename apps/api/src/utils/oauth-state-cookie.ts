import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * A browser-bound OAuth state: the random value lives only in an HttpOnly
 * cookie tied to the signed-in user, along with what the callback needs back.
 */
export function oauthStateCookie<T extends object>(name: string, path: string) {
  type Payload = { state: string; userId: string; data: T };

  return {
    start(c: Context, userId: string, data: T) {
      const state = randomBytes(24).toString("base64url");
      const payload: Payload = { state, userId, data };
      setCookie(
        c,
        name,
        Buffer.from(JSON.stringify(payload)).toString("base64url"),
        {
          path,
          httpOnly: true,
          sameSite: "Lax",
          secure: (process.env.KANEO_API_URL ?? "").startsWith("https://"),
          maxAge: 600,
        },
      );
      return state;
    },

    /** The saved data when the callback's state matches, else null. */
    consume(c: Context, userId: string, state: string | undefined): T | null {
      const raw = getCookie(c, name);
      deleteCookie(c, name, { path });
      if (!raw || !state) return null;
      try {
        const saved = JSON.parse(
          Buffer.from(raw, "base64url").toString(),
        ) as Payload;
        return equal(saved.state, state) && saved.userId === userId
          ? saved.data
          : null;
      } catch {
        return null;
      }
    },
  };
}
