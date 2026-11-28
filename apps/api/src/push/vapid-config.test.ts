import { createECDH, createPublicKey, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

const load = () => import("./vapid-config");
const NAMES = [
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_PRIVATE_KEY_FILE",
  "VAPID_SUBJECT",
  "KANEO_CLIENT_URL",
];
const configure = (values: Record<string, string>) => {
  for (const name of NAMES) vi.stubEnv(name, values[name] ?? "");
};
const keyPair = () => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey().toString("base64url"),
    privateKey: ecdh.getPrivateKey().toString("base64url"),
  };
};

describe("VAPID config", () => {
  it("keeps desktop push off until both keys are set", async () => {
    const { readVapidConfig } = await load();
    const keys = keyPair();
    configure({ VAPID_PUBLIC_KEY: keys.publicKey });
    expect(readVapidConfig()).toBeNull();
    configure({ VAPID_PRIVATE_KEY: keys.privateKey });
    expect(readVapidConfig()).toBeNull();
  });

  it("turns a key pair from web-push generate-vapid-keys into a signing key", async () => {
    const { readVapidConfig } = await load();
    const keys = keyPair();
    configure({
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: "mailto:push@example.test",
    });
    const config = readVapidConfig();
    expect(config).toMatchObject({
      publicKey: keys.publicKey,
      subject: "mailto:push@example.test",
    });
    const { signJwt } = await import("./sign-jwt");
    const jwt = signJwt("ES256", {}, { aud: "x" }, config?.privateKey ?? "");
    const [head, claims, signature] = jwt.split(".");
    const publicKey = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: Buffer.from(keys.publicKey, "base64url")
          .subarray(1, 33)
          .toString("base64url"),
        y: Buffer.from(keys.publicKey, "base64url")
          .subarray(33)
          .toString("base64url"),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${head}.${claims}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature ?? "", "base64url"),
      ),
    ).toBe(true);
  });

  it("falls back to the app address as the contact", async () => {
    const { readVapidConfig } = await load();
    const keys = keyPair();
    configure({
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      KANEO_CLIENT_URL: "https://kaneo.example.test",
    });
    expect(readVapidConfig()?.subject).toBe("https://kaneo.example.test");
  });

  it("stays off and says why when the keys do not form a pair", async () => {
    const { readVapidConfig } = await load();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    configure({
      VAPID_PUBLIC_KEY: keyPair().publicKey,
      VAPID_PRIVATE_KEY: keyPair().privateKey,
    });
    expect(readVapidConfig()).toBeNull();
    configure({ VAPID_PUBLIC_KEY: "short", VAPID_PRIVATE_KEY: "short" });
    expect(readVapidConfig()).toBeNull();
    expect(info).toHaveBeenCalledWith(
      "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not one P-256 key pair.",
    );
  });
});
