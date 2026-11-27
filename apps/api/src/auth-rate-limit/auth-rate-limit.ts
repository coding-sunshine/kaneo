import { AsyncLocalStorage } from "node:async_hooks";
import type { BetterAuthPlugin } from "better-auth";
import { readClientIp } from "../utils/client-ip";
import { readAccountIdentities } from "./account-identity";
import { isCredentialPath } from "./credential-paths";
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

const PROXY_HEADERS = ["x-forwarded-for", "forwarded", "x-real-ip"];

/**
 * Better Auth keys every limit by client address alone. Without
 * TRUSTED_PROXIES an ingress or proxy container is that address for everyone,
 * so three failed sign-ins would lock every user out. In that mode Better
 * Auth still picks each path's window and max, then hands the request to the
 * plugin below, which counts per address and account: every account the
 * request names is charged up front, and any full one refuses it. On
 * credential paths a success gives its charges back, so only failures fill
 * the limit. Requests that name no account, sign-ups among them, keep the
 * shared per-address bucket.
 */
export function createAuthRateLimit(
  trustedProxies = process.env.TRUSTED_PROXIES,
) {
  const perAccount = !trustedProxies?.trim();
  const pending = new WeakMap<Request, RateLimitRule>();
  const store = createRateLimitStore();
  // Charges a request may get back, collected while `track` runs it.
  const refundable = new AsyncLocalStorage<string[]>();
  let warnedAboutProxy = false;

  const rule =
    (fixed?: RateLimitRule) => (request: Request, current: RateLimitRule) => {
      const resolved = fixed ?? current;
      if (!perAccount) return resolved;
      pending.set(request, resolved);
      return false as const;
    };

  const warnOnceAboutProxy = (headers: Headers) => {
    if (warnedAboutProxy || !PROXY_HEADERS.some((name) => headers.has(name))) {
      return;
    }
    warnedAboutProxy = true;
    console.warn(
      "Auth requests arrive through a proxy but TRUSTED_PROXIES is not set. Auth rate limits then count per account, so repeated failed sign-ins from anyone behind the proxy can keep that account locked out. Set TRUSTED_PROXIES to the proxy's address to limit by client address instead.",
    );
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
    /**
     * Runs one auth request, giving back the account charges of a successful
     * credential check. Every `auth.handler` call goes through here.
     */
    async track(handle: () => Promise<Response>) {
      const charges: string[] = [];
      const response = await refundable.run(charges, handle);
      if (response.status < 300) {
        for (const key of charges) store.refund(key);
      }
      return response;
    },
    /** Must come first in `plugins`: it needs the request the rule saw. */
    plugin: {
      id: "kaneo-account-rate-limit",
      async onRequest(request, ctx) {
        const limit = pending.get(request);
        if (!limit) return;
        pending.delete(request);
        warnOnceAboutProxy(request.headers);
        const basePath = new URL(ctx.baseURL).pathname.replace(/\/$/, "");
        const path = new URL(request.url).pathname.slice(basePath.length);
        const live = (expiresAt: Date) => new Date(expiresAt) > new Date();
        const identities = await readAccountIdentities(
          request,
          path,
          [
            {
              name: ctx.authCookies.sessionToken.name,
              findUserId: async (token) => {
                const found = await ctx.internalAdapter.findSession(token);
                return found && live(found.session.expiresAt)
                  ? found.session.userId
                  : null;
              },
            },
            {
              name: ctx.createAuthCookie("two_factor").name,
              findUserId: async (identifier) => {
                const pending =
                  await ctx.internalAdapter.findVerificationValue(identifier);
                return pending && live(pending.expiresAt)
                  ? pending.value
                  : null;
              },
            },
          ],
          ctx.secret,
        );
        const scope = `${readClientIp(request.headers) ?? "no-ip"}|${path}`;
        const charged: string[] = [];
        let retryAfter = 0;
        for (const identity of identities.length ? identities : [""]) {
          const result = store.consume(
            `${scope}|${identity}`,
            limit,
            `${scope}|overflow`,
          );
          if (result.allowed) charged.push(result.key);
          else retryAfter = Math.max(retryAfter, result.retryAfter);
        }
        if (retryAfter > 0) {
          // A refused request was no attempt; keep the other limits as they were.
          for (const key of charged) store.refund(key);
          return { response: tooManyRequests(retryAfter) };
        }
        if (identities.length && isCredentialPath(path)) {
          refundable.getStore()?.push(...charged);
        }
      },
    } satisfies BetterAuthPlugin,
  };
}
