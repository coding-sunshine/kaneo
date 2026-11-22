import type { ToolClient } from "@kaneo/mcp/tools";
import { markInternalRequest } from "./internal-auth";

type SelfFetch = (request: Request) => Response | Promise<Response>;

// The running app registers itself so agent tools can call the regular API
// in-process, through the same auth middleware as any other client.
let selfFetch: SelfFetch | null = null;

export function setSelfFetch(fetcher: SelfFetch) {
  selfFetch = fetcher;
}

// Credentials a chat request carries; the agent forwards them unchanged so a
// tool call is authorised exactly like the caller's own request (API key
// scopes included).
const FORWARDED_HEADERS = ["cookie", "authorization", "x-api-key"];

export function forwardedAuthHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

// `auth` is forwarded credentials; `internalUserId` instead marks each request
// as an in-process run acting as that user (see internal-auth.ts).
export function createSelfClient(
  auth: Headers,
  internalUserId?: string,
): ToolClient {
  return {
    // Routes whoami to /api/user/me, which works for every credential type.
    usingApiKey: true,
    async json<T = unknown>(path: string, init?: RequestInit): Promise<T> {
      if (!selfFetch) throw new Error("API is not ready");
      const headers = new Headers(init?.headers);
      for (const [name, value] of auth) headers.set(name, value);
      if (init?.body != null && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      const request = new Request(`http://localhost${path}`, {
        ...init,
        headers,
      });
      if (internalUserId) markInternalRequest(request, internalUserId);
      const res = await selfFetch(request);
      const text = await res.text();
      let body: unknown = text || null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok) {
        const detail =
          typeof body === "object" && body !== null && "message" in body
            ? String((body as { message: unknown }).message)
            : `HTTP ${res.status}`;
        throw new Error(`${path}: ${detail}`);
      }
      return body as T;
    },
  };
}
