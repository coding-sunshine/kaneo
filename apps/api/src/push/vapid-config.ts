import { createECDH, createPrivateKey } from "node:crypto";
import { resolveFileSecret } from "../utils/file-secret";
import { logOnce } from "./push-config";

export type VapidConfig = {
  /** The uncompressed P-256 public key, base64url: the browser's applicationServerKey. */
  publicKey: string;
  /** The same key as PKCS#8 PEM, for signing. */
  privateKey: string;
  /** Who push services contact about this server: a mailto: or https: URL. */
  subject: string | null;
};

// Desktop pushes are signed with a VAPID key pair, in the base64url form
// `npx web-push generate-vapid-keys` prints. Without both keys they stay off.
export function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const secret = resolveFileSecret("VAPID_PRIVATE_KEY")?.trim();
  if (!publicKey || !secret) return null;
  const raw = Buffer.from(publicKey, "base64url");
  const d = Buffer.from(secret, "base64url");
  try {
    if (d.length !== 32) throw new Error("not P-256");
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(d);
    if (!ecdh.getPublicKey().equals(raw)) throw new Error("not a pair");
    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: raw.subarray(1, 33).toString("base64url"),
      y: raw.subarray(33).toString("base64url"),
    };
    const key = createPrivateKey({
      key: { ...jwk, d: d.toString("base64url") },
      format: "jwk",
    });
    return {
      publicKey,
      privateKey: key.export({ type: "pkcs8", format: "pem" }).toString(),
      subject:
        process.env.VAPID_SUBJECT?.trim() ||
        process.env.KANEO_CLIENT_URL?.trim() ||
        null,
    };
  } catch {
    logOnce(
      "vapid-pair",
      "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one P-256 key pair.",
    );
    return null;
  }
}
