import { createHmac } from "node:crypto";
import type { CallConfig } from "./call-config";

// Long enough to connect; LiveKit refreshes the token once in the room.
const TTL_SECONDS = 15 * 60;
// Valid slightly early, in case the LiveKit server's clock runs behind.
const CLOCK_SKEW_SECONDS = 30;

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/** A LiveKit access token: an HS256 JWT with a video grant for one room. */
export function createLiveKitToken(
  { apiKey, apiSecret }: Pick<CallConfig, "apiKey" | "apiSecret">,
  grant: { identity: string; name: string; room: string },
  now = Math.floor(Date.now() / 1000),
) {
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    iss: apiKey,
    sub: grant.identity,
    name: grant.name,
    nbf: now - CLOCK_SKEW_SECONDS,
    exp: now + TTL_SECONDS,
    video: {
      room: grant.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  })}`;
  const signature = createHmac("sha256", apiSecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}
