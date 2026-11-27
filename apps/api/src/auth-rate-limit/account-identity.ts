import { createHash } from "node:crypto";
import { parseCookies } from "better-auth/cookies";

const MAX_BODY_LENGTH = 16_384;

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
 * The account a request acts on: the email it names, else the value of the
 * session or pending two-factor cookie. Only those named cookies count, so
 * adding junk cookies cannot open a fresh bucket. Null when there is none.
 */
export async function readAccountIdentity(
  request: Request,
  cookieNames: string[],
) {
  const email = await readEmail(request);
  if (email) return `email:${hash(email)}`;
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  for (const name of cookieNames) {
    const value = cookies.get(name);
    if (value) return `cookie:${hash(value)}`;
  }
  return null;
}
