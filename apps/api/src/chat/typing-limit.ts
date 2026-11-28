import { HTTPException } from "hono/http-exception";
import { createUserRateLimit } from "../utils/user-rate-limit";

// Clients send a start every 3 seconds at most, so one start and one stop per
// second per person and channel only stops a stuck client or a script.
// Starts and stops count apart, so a stop right after a start still clears.
const limit = createUserRateLimit({ limit: 1, windowMs: 1000 });

export function assertCanSendTyping(
  userId: string,
  channelId: string,
  typing: boolean,
) {
  if (limit.take(`${userId}:${channelId}:${typing}`).ok) return;
  throw new HTTPException(429, { message: "Too many typing signals" });
}
