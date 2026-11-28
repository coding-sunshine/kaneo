import { sign } from "node:crypto";

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/** A compact JWT signed with ES256 (APNs) or RS256 (Google service accounts). */
export function signJwt(
  alg: "ES256" | "RS256",
  header: Record<string, string>,
  claims: Record<string, unknown>,
  privateKey: string,
) {
  const input = `${base64url(JSON.stringify({ alg, typ: "JWT", ...header }))}.${base64url(JSON.stringify(claims))}`;
  const signature = sign("sha256", Buffer.from(input), {
    key: privateKey,
    // JWS wants the raw r||s pair for ECDSA, not DER.
    ...(alg === "ES256" ? { dsaEncoding: "ieee-p1363" as const } : {}),
  });
  return `${input}.${base64url(signature)}`;
}
