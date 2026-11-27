import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseCookies } from "better-auth/cookies";

const MAX_BODY_LENGTH = 16_384;

// Paths where the email in the body is the account the request acts on.
// Anywhere else (an invitee, a new address) it says nothing about the caller.
const EMAIL_ACCOUNT_PATHS = [
  "/sign-in/email",
  "/sign-in/magic-link",
  "/email-otp/",
  "/request-password-reset",
  "/forget-password",
  "/send-verification-email",
];

// Requests that create a session: each success would mint a new valid
// cookie, so a cookie never names the caller there.
const SESSION_CREATING_PATHS = ["/sign-up/", "/sign-in/anonymous"];

const hash = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

/** A cookie that names an account once the server finds what it points to. */
export type AccountCookie = {
  name: string;
  findUserId: (value: string) => Promise<string | null>;
};

/** The value of a cookie Better Auth signed (`value.signature`), or null. */
function verifySignedValue(cookie: string, secret: string) {
  const dot = cookie.lastIndexOf(".");
  if (dot < 1) return null;
  const value = cookie.slice(0, dot);
  const signature = Buffer.from(cookie.slice(dot + 1), "base64");
  const expected = createHmac("sha256", secret).update(value).digest();
  return signature.length === expected.length &&
    timingSafeEqual(signature, expected)
    ? value
    : null;
}

async function readEmail(request: Request) {
  if (request.method !== "POST") return null;
  const type = request.headers.get("content-type") ?? "";
  const text = await request.clone().text();
  if (text.length > MAX_BODY_LENGTH) return null;
  let email: unknown;
  if (type.includes("application/json")) {
    try {
      email = (JSON.parse(text) as { email?: unknown } | null)?.email;
    } catch {
      return null;
    }
  } else if (type.includes("application/x-www-form-urlencoded")) {
    email = new URLSearchParams(text).get("email");
  }
  // Better Auth looks accounts up by the trimmed, lowercased address.
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : null;
}

/**
 * Every account a request names: the email on sign-in and recovery paths,
 * and the user behind a live session or pending two-factor sign-in. Anyone
 * can send made-up cookies, so a cookie counts only when it is signed and
 * points to a live record; every session of one user is the same account.
 * The caller charges each one, so changing one of them never opens a fresh
 * limit while another stays the same. No cookie counts on paths that create
 * a session. Empty when none.
 */
export async function readAccountIdentities(
  request: Request,
  path: string,
  accountCookies: AccountCookie[],
  secret: string,
) {
  const identities: string[] = [];
  if (EMAIL_ACCOUNT_PATHS.some((prefix) => path.startsWith(prefix))) {
    const email = await readEmail(request);
    if (email) identities.push(`email:${hash(email)}`);
  }
  if (SESSION_CREATING_PATHS.some((prefix) => path.startsWith(prefix))) {
    return identities;
  }
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  for (const { name, findUserId } of accountCookies) {
    const cookie = cookies.get(name);
    const value = cookie && verifySignedValue(cookie, secret);
    const userId = value ? await findUserId(value) : null;
    if (userId && !identities.includes(`user:${userId}`)) {
      identities.push(`user:${userId}`);
    }
  }
  return identities;
}
