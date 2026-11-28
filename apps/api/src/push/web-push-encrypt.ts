import {
  createCipheriv,
  createECDH,
  type ECDH,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const RECORD_SIZE = 4096;
const info = (label: string) => Buffer.from(`Content-Encoding: ${label}\0`);

/**
 * Encrypts a push payload for one browser with the aes128gcm scheme of
 * RFC 8291: a one-off server key and salt, keyed to the browser's p256dh key
 * and auth secret. The result is the whole request body, header included.
 * `fresh` is for the RFC test vector only.
 */
export function encryptWebPush(
  payload: Buffer,
  keys: { p256dh: string; auth: string },
  fresh: { server?: ECDH; salt?: Buffer } = {},
) {
  const browserKey = Buffer.from(keys.p256dh, "base64url");
  const auth = Buffer.from(keys.auth, "base64url");
  const server = fresh.server ?? createECDH("prime256v1");
  if (!fresh.server) server.generateKeys();
  const serverKey = server.getPublicKey();
  const salt = fresh.salt ?? randomBytes(16);

  const secret = server.computeSecret(browserKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    browserKey,
    serverKey,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", secret, auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, info("aes128gcm"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, info("nonce"), 12));

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // One record: the payload, then the 0x02 last-record delimiter.
  const sealed = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverKey.length, 20);
  return Buffer.concat([header, serverKey, sealed]);
}
