import { HTTPException } from "hono/http-exception";
import { createUserRateLimit } from "../utils/user-rate-limit";

// Far above anyone typing: it only stops a stuck client or a script from
// flooding one channel. Counted per person and channel, replies included.
const limit = createUserRateLimit({ limit: 20, windowMs: 10_000 });

export function assertCanPostMessage(userId: string, channelId: string) {
  const result = limit.take(`${userId}:${channelId}`);
  if (result.ok) return;
  const message = "Too many messages at once. Try again shortly.";
  throw new HTTPException(429, {
    message,
    res: Response.json(
      { message, code: "TOO_MANY_REQUESTS" },
      {
        status: 429,
        headers: { "retry-after": String(result.retryAfterSeconds) },
      },
    ),
  });
}
