import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** A team's address token: 128 random bits, unguessable. */
export const createIntakeToken = () => randomBytes(16).toString("hex");

export const hashIntakeToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function sameIntakeToken(stored: string, given: string) {
  const a = Buffer.from(stored);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
