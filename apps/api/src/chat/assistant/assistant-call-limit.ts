import { createUserRateLimit } from "../../utils/user-rate-limit";

// Each mention is a model call and a person's token budget may be unlimited,
// so one person gets one answer per 30 seconds and 50 a day.
const burst = createUserRateLimit({ limit: 1, windowMs: 30_000 });
const daily = createUserRateLimit({ limit: 50, windowMs: 24 * 60 * 60_000 });

/** Takes one of the person's assistant calls; false when none is left. */
export const takeAssistantCall = (userId: string) =>
  burst.take(userId).ok && daily.take(userId).ok;
