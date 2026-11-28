import {
  OutboundRequestError,
  sendOutboundRequest,
} from "../utils/outbound-request";
import type { PushSender } from "./push-message";
import { signJwt } from "./sign-jwt";
import type { VapidConfig } from "./vapid-config";
import { encryptWebPush } from "./web-push-encrypt";
import { parseWebPushToken } from "./web-push-token";

// Push services accept a VAPID token for up to a day.
const TOKEN_TTL_S = 12 * 60 * 60;
// A desktop alert for a message is stale after a day offline.
const MESSAGE_TTL_S = 24 * 60 * 60;

/**
 * Sends encrypted alerts to a browser's push service (RFC 8030, 8291,
 * 8292). The endpoint comes from the browser, so it goes through the guard
 * that refuses private addresses.
 */
export function createWebPushSender(config: VapidConfig): PushSender {
  return async (token, message) => {
    const subscription = parseWebPushToken(token);
    if (!subscription) return "dead";
    let audience: string;
    try {
      audience = new URL(subscription.endpoint).origin;
    } catch {
      return "dead";
    }
    const jwt = signJwt(
      "ES256",
      {},
      {
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S,
        ...(config.subject ? { sub: config.subject } : {}),
      },
      config.privateKey,
    );
    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      tag: message.data.messageId,
      data: message.data,
    });
    try {
      await sendOutboundRequest(
        subscription.endpoint,
        {
          headers: {
            authorization: `vapid t=${jwt}, k=${config.publicKey}`,
            "content-encoding": "aes128gcm",
            "content-type": "application/octet-stream",
            ttl: String(MESSAGE_TTL_S),
            urgency: "high",
          },
          body: encryptWebPush(Buffer.from(payload), subscription),
        },
        { publicDestination: true },
      );
      return "sent";
    } catch (error) {
      const gone =
        error instanceof OutboundRequestError &&
        (error.status === 404 || error.status === 410);
      return gone ? "dead" : "failed";
    }
  };
}
