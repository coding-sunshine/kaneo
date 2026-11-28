import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

const load = () => import("./push-config");
const NAMES = [
  "APNS_KEY_ID",
  "APNS_TEAM_ID",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_FILE",
  "APNS_TOPIC",
  "APNS_SANDBOX",
  "APNS_HOST",
  "FCM_SERVICE_ACCOUNT",
  "FCM_SERVICE_ACCOUNT_FILE",
  "FCM_HOST",
];
const configure = (values: Record<string, string>) => {
  for (const name of NAMES) vi.stubEnv(name, values[name] ?? "");
};

describe("push config", () => {
  it("keeps iOS off until the key id, team id and key are all set", async () => {
    const { readApnsConfig } = await load();
    configure({ APNS_KEY_ID: "KEY", APNS_TEAM_ID: "TEAM" });
    expect(readApnsConfig()).toBeNull();

    configure({
      APNS_KEY_ID: "KEY",
      APNS_TEAM_ID: "TEAM",
      APNS_PRIVATE_KEY:
        "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----",
    });
    expect(readApnsConfig()).toEqual({
      keyId: "KEY",
      teamId: "TEAM",
      privateKey:
        "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
      topic: "app.kaneo",
      host: "https://api.push.apple.com",
    });
  });

  it("uses Apple's sandbox when asked", async () => {
    const { readApnsConfig } = await load();
    configure({
      APNS_KEY_ID: "KEY",
      APNS_TEAM_ID: "TEAM",
      APNS_PRIVATE_KEY: "fake",
      APNS_SANDBOX: "true",
    });
    expect(readApnsConfig()?.host).toBe("https://api.sandbox.push.apple.com");
  });

  it("keeps Android off without a whole service account", async () => {
    const { readFcmConfig } = await load();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    configure({});
    expect(readFcmConfig()).toBeNull();
    configure({ FCM_SERVICE_ACCOUNT: "not json" });
    expect(readFcmConfig()).toBeNull();
    configure({ FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p" }) });
    expect(readFcmConfig()).toBeNull();
    expect(info).toHaveBeenCalledTimes(2);

    configure({
      FCM_SERVICE_ACCOUNT: JSON.stringify({
        project_id: "p",
        client_email: "push@p.example.test",
        private_key: "fake",
      }),
    });
    expect(readFcmConfig()).toEqual({
      projectId: "p",
      clientEmail: "push@p.example.test",
      privateKey: "fake",
      tokenUri: "https://oauth2.googleapis.com/token",
      host: "https://fcm.googleapis.com",
    });
  });

  it("says once per platform that push is off", async () => {
    const { logPushOffOnce } = await load();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logPushOffOnce("ios");
    logPushOffOnce("ios");
    logPushOffOnce("android");
    expect(info.mock.calls.map(([line]) => line)).toEqual([
      "iOS push is off: set APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY to turn it on.",
      "Android push is off: set FCM_SERVICE_ACCOUNT to turn it on.",
    ]);
  });
});
