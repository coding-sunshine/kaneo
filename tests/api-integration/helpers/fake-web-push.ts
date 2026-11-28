import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  type ECDH,
  hkdfSync,
  randomBytes,
  verify,
} from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type FakeWebPush = {
  subscription: string;
  payload: Record<string, unknown>;
};

const info = (label: string) => Buffer.from(`Content-Encoding: ${label}\0`);

// Reverses RFC 8291 with the browser's private key, as a browser would.
function decrypt(body: Buffer, browser: ECDH, auth: Buffer) {
  const salt = body.subarray(0, 16);
  const idLength = body[20] ?? 0;
  const serverKey = body.subarray(21, 21 + idLength);
  const sealed = body.subarray(21 + idLength);
  const secret = browser.computeSecret(serverKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    browser.getPublicKey(),
    serverKey,
  ]);
  const ikm = Buffer.from(hkdfSync("sha256", secret, auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, info("aes128gcm"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, info("nonce"), 12));
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(sealed.subarray(-16));
  const plain = Buffer.concat([
    decipher.update(sealed.subarray(0, -16)),
    decipher.final(),
  ]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString("utf8");
}

// Checks the VAPID header the way a push service does: right key, valid
// signature, audience of this origin, not expired.
function vapidAccepted(header: string, publicKey: string, origin: string) {
  const match = header.match(/^vapid t=([^,]+), k=(.+)$/);
  if (!match || match[2] !== publicKey) return false;
  const [head, claims, signature] = (match[1] ?? "").split(".");
  const raw = Buffer.from(publicKey, "base64url");
  const key = createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: raw.subarray(1, 33).toString("base64url"),
      y: raw.subarray(33).toString("base64url"),
    },
    format: "jwk",
  });
  if (
    !verify(
      "sha256",
      Buffer.from(`${head}.${claims}`),
      { key, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature ?? "", "base64url"),
    )
  )
    return false;
  const parsed = JSON.parse(Buffer.from(claims ?? "", "base64url").toString());
  return parsed.aud === origin && parsed.exp > Date.now() / 1000;
}

/**
 * A local stand-in for a browser vendor's push service: it holds browser
 * keys for subscriptions it hands out, checks the VAPID header and decrypts
 * what arrives, so a test runs the real sender without any vendor.
 */
export async function startFakeWebPush() {
  const pushes: FakeWebPush[] = [];
  const rejected: string[] = [];
  const gone = new Set<string>();
  const browsers = new Map<string, { ecdh: ECDH; auth: Buffer }>();
  const vapid = createECDH("prime256v1");
  vapid.generateKeys();
  const publicKey = vapid.getPublicKey().toString("base64url");
  let origin = "";

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const id = String(req.url).replace("/push/", "");
      const browser = browsers.get(id);
      if (!browser || gone.has(id)) {
        res.statusCode = 410;
        res.end();
        return;
      }
      if (
        req.headers["content-encoding"] !== "aes128gcm" ||
        !req.headers.ttl ||
        !vapidAccepted(String(req.headers.authorization), publicKey, origin)
      ) {
        rejected.push(id);
        res.statusCode = 403;
        res.end();
        return;
      }
      pushes.push({
        subscription: id,
        payload: JSON.parse(
          decrypt(Buffer.concat(chunks), browser.ecdh, browser.auth),
        ),
      });
      res.statusCode = 201;
      res.end();
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  /** A subscription as PushSubscription.toJSON() gives it. */
  const subscribe = (id: string) => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const auth = randomBytes(16);
    browsers.set(id, { ecdh, auth });
    return {
      endpoint: `${origin}/push/${id}`,
      keys: {
        p256dh: ecdh.getPublicKey().toString("base64url"),
        auth: auth.toString("base64url"),
      },
    };
  };

  return {
    env: {
      VAPID_PUBLIC_KEY: publicKey,
      VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url"),
      VAPID_SUBJECT: "mailto:push@example.test",
      // The fake listens on loopback, which outbound requests refuse by default.
      KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS: "true",
    } as Record<string, string>,
    publicKey,
    pushes,
    rejected,
    gone,
    subscribe,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
