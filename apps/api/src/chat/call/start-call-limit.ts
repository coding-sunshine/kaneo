import { HTTPException } from "hono/http-exception";
import { createUserRateLimit } from "../../utils/user-rate-limit";

// Each start rings every other member, so one person cannot ring on a loop.
const limit = createUserRateLimit({ limit: 10, windowMs: 60_000 });

export function assertCanStartCall(userId: string) {
  const result = limit.take(userId);
  if (result.ok) return;
  throw new HTTPException(429, {
    message: "Too many calls started. Try again shortly.",
    res: new Response(null, {
      status: 429,
      headers: { "retry-after": String(result.retryAfterSeconds) },
    }),
  });
}
