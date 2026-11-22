import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const NAME = "kaneo_github_reviews_oauth";
const PATH = "/api/github-reviews";

type Payload = { state: string; userId: string; returnTo: string };

const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Starts a flow: the random state lives only in this browser, tied to the user. */
export function startOAuthState(c: Context, userId: string, returnTo: string) {
  const state = randomBytes(24).toString("base64url");
  const payload: Payload = { state, userId, returnTo };
  setCookie(
    c,
    NAME,
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    {
      path: PATH,
      httpOnly: true,
      sameSite: "Lax",
      secure: (process.env.KANEO_API_URL ?? "").startsWith("https://"),
      maxAge: 600,
    },
  );
  return state;
}

/** Returns the saved return path when the callback's state matches, else null. */
export function consumeOAuthState(
  c: Context,
  userId: string,
  state: string | undefined,
) {
  const raw = getCookie(c, NAME);
  deleteCookie(c, NAME, { path: PATH });
  if (!raw || !state) return null;
  try {
    const saved = JSON.parse(
      Buffer.from(raw, "base64url").toString(),
    ) as Payload;
    return equal(saved.state, state) && saved.userId === userId
      ? saved.returnTo
      : null;
  } catch {
    return null;
  }
}
