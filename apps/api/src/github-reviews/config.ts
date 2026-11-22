import { resolveFileSecret } from "../utils/file-secret";

// Read per call so a deployment can add the credentials without code changes.
// Deliberately not GITHUB_CLIENT_ID: that variable turns on GitHub sign-in.
export function getReviewsOAuthConfig() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = resolveFileSecret("GITHUB_APP_CLIENT_SECRET")?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getCallbackUrl() {
  const apiUrl = (process.env.KANEO_API_URL || "http://localhost:1337")
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");
  return `${apiUrl}/api/github-reviews/callback`;
}

export function getClientUrl() {
  return (process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(
    /\/+$/,
    "",
  );
}

/** Only app-relative paths, so the callback cannot redirect off the web app. */
export function safeReturnPath(path: string | undefined) {
  return path && /^\/(?![/\\])/.test(path) ? path : "/dashboard";
}
