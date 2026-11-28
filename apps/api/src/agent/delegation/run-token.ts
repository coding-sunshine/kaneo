import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** A new callback token for a run, and the hash stored in its place. */
export function newRunToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hash(token) };
}

export function tokenMatches(token: string, tokenHash: string) {
  const given = Buffer.from(hash(token));
  const stored = Buffer.from(tokenHash);
  return given.length === stored.length && timingSafeEqual(given, stored);
}
