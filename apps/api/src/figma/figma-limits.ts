import { HTTPException } from "hono/http-exception";
import { createUserRateLimit } from "../utils/user-rate-limit";

// Lookups that reach Figma (cache misses and refreshes) per person.
export const FIGMA_LOOKUP_LIMIT = 20;
const FIGMA_LOOKUP_WINDOW_MS = 10 * 60_000;

// A file the token cannot open, or a Figma outage, is not asked again sooner.
export const FIGMA_FAILURE_TTL_MS = 5 * 60_000;

// Figma's rendered image links are signed and expire (the API docs say within
// 30 days); a stored card older than this gets a new link or loses its image.
export const FIGMA_THUMBNAIL_TTL_MS = 14 * 24 * 60 * 60_000;

const lookups = createUserRateLimit({
  limit: FIGMA_LOOKUP_LIMIT,
  windowMs: FIGMA_LOOKUP_WINDOW_MS,
});

/** Counts one Figma lookup for the person; false when they are over the cap. */
export function takeFigmaLookup(userId: string) {
  return lookups.take(userId);
}

export function figmaLookupLimited(retryAfterSeconds: number) {
  return new HTTPException(429, {
    message: "Too many Figma previews looked up. Try again shortly.",
    res: new Response(null, {
      status: 429,
      headers: { "retry-after": String(retryAfterSeconds) },
    }),
  });
}

type Failure = { status: 404 | 502; until: number };

// Kept in this process, like the lookup cap: each API instance remembers its
// own failures, which is enough to keep one bad link from hammering Figma.
const failures = new Map<string, Failure>();

const failureKey = (workspaceId: string, fileKey: string, nodeId: string) =>
  `${workspaceId}\u0000${fileKey}\u0000${nodeId}`;

export function rememberFigmaFailure(
  workspaceId: string,
  fileKey: string,
  nodeId: string,
  status: Failure["status"],
) {
  const now = Date.now();
  for (const [key, failure] of failures)
    if (failure.until <= now) failures.delete(key);
  failures.set(failureKey(workspaceId, fileKey, nodeId), {
    status,
    until: now + FIGMA_FAILURE_TTL_MS,
  });
}

export function recentFigmaFailure(
  workspaceId: string,
  fileKey: string,
  nodeId: string,
) {
  const key = failureKey(workspaceId, fileKey, nodeId);
  const failure = failures.get(key);
  if (!failure) return null;
  if (failure.until > Date.now()) return failure.status;
  failures.delete(key);
  return null;
}
