import { type ClientHttp2Session, connect } from "node:http2";
import type { ApnsConfig } from "./push-config";
import type { PushSender } from "./push-message";
import { signJwt } from "./sign-jwt";

// Apple accepts a provider token for an hour and throttles fresh ones.
const TOKEN_TTL_MS = 50 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const DEAD_REASONS = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "Unregistered",
]);

/** Sends alerts over one HTTP/2 connection to APNs, reopened when it drops. */
export function createApnsSender(config: ApnsConfig): PushSender {
  let session: ClientHttp2Session | null = null;
  let jwt: { value: string; at: number } | null = null;

  const authorization = () => {
    if (!jwt || Date.now() - jwt.at > TOKEN_TTL_MS) {
      const at = Date.now();
      jwt = {
        at,
        value: signJwt(
          "ES256",
          { kid: config.keyId },
          { iss: config.teamId, iat: Math.floor(at / 1000) },
          config.privateKey,
        ),
      };
    }
    return `bearer ${jwt.value}`;
  };

  const open = () => {
    if (session && !session.closed && !session.destroyed) return session;
    const next = connect(config.host);
    next.on("error", () => next.destroy());
    next.on("close", () => {
      if (session === next) session = null;
    });
    // Idle connections must not keep the process alive.
    next.unref();
    session = next;
    return next;
  };

  return (token, message) =>
    new Promise((resolve) => {
      const payload = JSON.stringify({
        aps: {
          alert: { title: message.title, body: message.body },
          sound: "default",
          "thread-id": message.threadId,
        },
        // expo-notifications hands this key to the app as content.data.
        body: message.data,
      });
      let request: ReturnType<ClientHttp2Session["request"]>;
      try {
        request = open().request({
          ":method": "POST",
          ":path": `/3/device/${encodeURIComponent(token)}`,
          authorization: authorization(),
          "apns-topic": config.topic,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        });
      } catch {
        resolve("failed");
        return;
      }
      let status = 0;
      let text = "";
      request.setEncoding("utf8");
      request.setTimeout(TIMEOUT_MS, () => request.close());
      request.on("response", (headers) => {
        status = Number(headers[":status"]);
      });
      request.on("data", (chunk: string) => (text += chunk));
      request.on("error", () => resolve("failed"));
      request.on("close", () => {
        if (status === 200) return resolve("sent");
        let reason = "";
        try {
          reason = JSON.parse(text).reason ?? "";
        } catch {
          /* No JSON body. */
        }
        resolve(status === 410 || DEAD_REASONS.has(reason) ? "dead" : "failed");
      });
      request.end(payload);
    });
}
