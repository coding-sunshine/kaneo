import { createHmac } from "node:crypto";
import type { CallConfig } from "./call-config";

// Long enough to connect; LiveKit refreshes the token once in the room.
const TTL_SECONDS = 15 * 60;
// Valid slightly early, in case the LiveKit server's clock runs behind.
const CLOCK_SKEW_SECONDS = 30;

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

function sign(
  { apiKey, apiSecret }: Pick<CallConfig, "apiKey" | "apiSecret">,
  claims: Record<string, unknown>,
  now: number,
) {
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    iss: apiKey,
    ...claims,
    nbf: now - CLOCK_SKEW_SECONDS,
    exp: now + TTL_SECONDS,
  })}`;
  const signature = createHmac("sha256", apiSecret)
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

/** A LiveKit access token: an HS256 JWT with a video grant for one room. */
export function createLiveKitToken(
  config: Pick<CallConfig, "apiKey" | "apiSecret">,
  grant: { identity: string; name: string; room: string },
  now = Math.floor(Date.now() / 1000),
) {
  return sign(
    config,
    {
      sub: grant.identity,
      name: grant.name,
      video: {
        room: grant.room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    },
    now,
  );
}

/** Lets the API manage one room, such as removing a participant. */
export function createRoomAdminToken(
  config: Pick<CallConfig, "apiKey" | "apiSecret">,
  room: string,
  now = Math.floor(Date.now() / 1000),
) {
  return sign(config, { video: { room, roomAdmin: true } }, now);
}
