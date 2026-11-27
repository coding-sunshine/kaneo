import { createHash } from "node:crypto";
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

const hash = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

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
 * and the values of the session and pending two-factor cookies. The caller
 * charges each one, so changing one of them never opens a fresh limit while
 * another stays the same. Only the named cookies count. Empty when none.
 */
export async function readAccountIdentities(
  request: Request,
  path: string,
  cookieNames: string[],
) {
  const identities: string[] = [];
  if (EMAIL_ACCOUNT_PATHS.some((prefix) => path.startsWith(prefix))) {
    const email = await readEmail(request);
    if (email) identities.push(`email:${hash(email)}`);
  }
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  for (const name of cookieNames) {
    const value = cookies.get(name);
    if (value) identities.push(`${name}:${hash(value)}`);
  }
  return identities;
}
