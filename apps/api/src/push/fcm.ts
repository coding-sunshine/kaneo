import type { FcmConfig } from "./push-config";
import type { PushSender } from "./push-message";
import { signJwt } from "./sign-jwt";

const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
// The Android notification channel the app creates (see app.json).
const ANDROID_CHANNEL = "kaneo_activity";
const TIMEOUT_MS = 10_000;

/** Sends through Firebase Cloud Messaging (HTTP v1) with a service account. */
export function createFcmSender(config: FcmConfig): PushSender {
  let access: { token: string; expiresAt: number } | null = null;

  const accessToken = async () => {
    if (access && Date.now() < access.expiresAt) return access.token;
    const iat = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      "RS256",
      {},
      {
        iss: config.clientEmail,
        scope: SCOPE,
        aud: config.tokenUri,
        iat,
        exp: iat + 3600,
      },
      config.privateKey,
    );
    const response = await fetch(config.tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`FCM token request: ${response.status}`);
    const body = (await response.json()) as {
      access_token: string;
      expires_in?: number;
    };
    // Renew a minute early so a send never carries an expired token.
    const ttl = Math.max(60, (body.expires_in ?? 3600) - 60);
    access = { token: body.access_token, expiresAt: Date.now() + ttl * 1000 };
    return access.token;
  };

  return async (token, message) => {
    try {
      const response = await fetch(
        `${config.host}/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${await accessToken()}`,
            "content-type": "application/json",
          },
          // A data message, so expo-notifications builds the notification and
          // passes the JSON in `body` to the app as content.data on a tap.
          body: JSON.stringify({
            message: {
              token,
              data: {
                title: message.title,
                message: message.body,
                body: JSON.stringify(message.data),
                channelId: ANDROID_CHANNEL,
                threadIdentifier: message.threadId,
              },
              android: { priority: "high" },
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (response.ok) return "sent";
      if (response.status === 401) access = null;
      const body = (await response.json().catch(() => null)) as {
        error?: { details?: { errorCode?: string }[] };
      } | null;
      const unregistered = body?.error?.details?.some(
        (detail) => detail.errorCode === "UNREGISTERED",
      );
      return unregistered ? "dead" : "failed";
    } catch {
      return "failed";
    }
  };
}
