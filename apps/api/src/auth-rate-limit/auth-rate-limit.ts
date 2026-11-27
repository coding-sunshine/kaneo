import type { BetterAuthPlugin } from "better-auth";
import { readClientIp } from "../utils/client-ip";
import { readAccountIdentities } from "./account-identity";
import { createRateLimitStore, type RateLimitRule } from "./rate-limit-store";

function tooManyRequests(retryAfter: number) {
  return new Response(
    JSON.stringify({ message: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-Retry-After": String(retryAfter),
      },
    },
  );
}

/**
 * Better Auth keys every limit by client address alone. Without
 * TRUSTED_PROXIES an ingress or proxy container is that address for everyone,
 * so three failed sign-ins would lock every user out. In that mode Better
 * Auth still picks each path's window and max, then hands the request to the
 * plugin below, which counts per address and account: every account the
 * request names is charged, and any full one refuses it. Requests that name
 * no account, sign-ups among them, keep the shared per-address bucket.
 */
export function createAuthRateLimit(
  trustedProxies = process.env.TRUSTED_PROXIES,
) {
  const perAccount = !trustedProxies?.trim();
  const pending = new WeakMap<Request, RateLimitRule>();
  const store = createRateLimitStore();

  const rule =
    (fixed?: RateLimitRule) => (request: Request, current: RateLimitRule) => {
      const resolved = fixed ?? current;
      if (!perAccount) return resolved;
      pending.set(request, resolved);
      return false as const;
    };

  return {
    perAccount,
    /** First match wins, so the catch-all comes after the overrides. */
    customRules(overrides: Record<string, RateLimitRule>) {
      return {
        ...Object.fromEntries(
          Object.entries(overrides).map(([path, fixed]) => [path, rule(fixed)]),
        ),
        "/**": rule(),
      };
    },
    /** Must come first in `plugins`: it needs the request the rule saw. */
    plugin: {
      id: "kaneo-account-rate-limit",
      async onRequest(request, ctx) {
        const limit = pending.get(request);
        if (!limit) return;
        pending.delete(request);
        const basePath = new URL(ctx.baseURL).pathname.replace(/\/$/, "");
        const path = new URL(request.url).pathname.slice(basePath.length);
        const identities = await readAccountIdentities(request, path, [
          ctx.authCookies.sessionToken.name,
          ctx.createAuthCookie("two_factor").name,
        ]);
        const ip = readClientIp(request.headers) ?? "no-ip";
        let retryAfter = 0;
        for (const identity of identities.length ? identities : [""]) {
          const result = store.consume(`${ip}|${path}|${identity}`, limit);
          if (!result.allowed) {
            retryAfter = Math.max(retryAfter, result.retryAfter);
          }
        }
        if (retryAfter > 0) return { response: tooManyRequests(retryAfter) };
      },
    } satisfies BetterAuthPlugin,
  };
}
