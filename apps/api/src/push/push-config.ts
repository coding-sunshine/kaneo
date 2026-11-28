import { resolveFileSecret } from "../utils/file-secret";

export type ApnsConfig = {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
  host: string;
};

export type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  host: string;
};

const pem = (value: string) => value.replace(/\\n/g, "\n");

// iOS pushes go through Apple with a .p8 key from an Apple Developer account.
// Without the key id, team id and key the platform stays off.
export function readApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKey = resolveFileSecret("APNS_PRIVATE_KEY")?.trim();
  if (!keyId || !teamId || !privateKey) return null;
  const sandbox = process.env.APNS_SANDBOX?.trim() === "true";
  return {
    keyId,
    teamId,
    privateKey: pem(privateKey),
    topic: process.env.APNS_TOPIC?.trim() || "app.kaneo",
    host:
      process.env.APNS_HOST?.trim() ||
      (sandbox
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com"),
  };
}

// Android pushes go through Firebase with a service account key (the JSON
// file Firebase hands out). Without it the platform stays off.
export function readFcmConfig(): FcmConfig | null {
  const raw = resolveFileSecret("FCM_SERVICE_ACCOUNT")?.trim();
  if (!raw) return null;
  let account: Record<string, unknown>;
  try {
    account = JSON.parse(raw);
  } catch {
    logOnce("fcm-json", "FCM_SERVICE_ACCOUNT is not valid JSON.");
    return null;
  }
  const field = (name: string) =>
    typeof account[name] === "string" ? (account[name] as string) : "";
  const projectId = field("project_id");
  const clientEmail = field("client_email");
  const privateKey = field("private_key");
  if (!projectId || !clientEmail || !privateKey) {
    logOnce(
      "fcm-fields",
      "FCM_SERVICE_ACCOUNT needs project_id, client_email and private_key.",
    );
    return null;
  }
  return {
    projectId,
    clientEmail,
    privateKey: pem(privateKey),
    tokenUri: field("token_uri") || "https://oauth2.googleapis.com/token",
    host: process.env.FCM_HOST?.trim() || "https://fcm.googleapis.com",
  };
}

const told = new Set<string>();

export function logOnce(key: string, line: string) {
  if (told.has(key)) return;
  told.add(key);
  console.info(line);
}

const OFF = {
  ios: "iOS push is off: set APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY to turn it on.",
  android: "Android push is off: set FCM_SERVICE_ACCOUNT to turn it on.",
  web: "Desktop push is off: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to turn it on.",
};

export function logPushOffOnce(platform: keyof typeof OFF) {
  logOnce(`off-${platform}`, OFF[platform]);
}
