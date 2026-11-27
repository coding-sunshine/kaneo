import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import type { twoFactor } from "better-auth/plugins";

// Their new session belongs to someone already signed in (refresh, profile,
// workspace switch, impersonation, a device the person approved), or they
// are a second step themselves. `/sign-in/email` gets the plugin's own check.
const EXEMPT_PREFIXES = [
  "/two-factor/",
  "/organization/",
  "/admin/",
  "/device/",
  "/passkey/",
  "/api-key/",
];
const EXEMPT_PATHS = new Set([
  "/sign-in/email",
  "/get-session",
  "/update-session",
  "/update-user",
  "/change-password",
  "/change-email",
]);

function isExempt(path: string) {
  return (
    EXEMPT_PATHS.has(path) ||
    EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

// Sign-ins that end in a redirect back to the web app instead of JSON.
const REDIRECT_PREFIXES = [
  "/callback/",
  "/oauth2/callback/",
  "/magic-link/verify",
  "/verify-email",
];

/**
 * Better Auth's two-factor plugin only challenges password sign-in. This runs
 * the same challenge after every other sign-in (email code, magic link, OAuth,
 * guest upgrade), so no session exists until the second step is done.
 * Redirecting sign-ins land on the web app's two-factor page.
 */
export function challengeEverySignIn(
  plugin: ReturnType<typeof twoFactor>,
  twoFactorPageUrl: string,
): BetterAuthPlugin {
  const challenge = plugin.hooks?.after?.[0]?.handler;
  if (!challenge) {
    throw new Error("The two-factor plugin no longer exposes its challenge");
  }
  const applies = (path: string | undefined) => !isExempt(path ?? "");
  return {
    id: "two-factor-every-sign-in",
    hooks: {
      after: [
        // Skips sessions without two-factor and trusted devices itself.
        { matcher: (ctx) => applies(ctx.path), handler: challenge },
        {
          matcher: (ctx) =>
            applies(ctx.path) &&
            REDIRECT_PREFIXES.some((prefix) => ctx.path?.startsWith(prefix)),
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as {
              twoFactorRedirect?: boolean;
            } | null;
            if (returned?.twoFactorRedirect) {
              throw ctx.redirect(twoFactorPageUrl);
            }
          }),
        },
      ],
    },
  };
}
