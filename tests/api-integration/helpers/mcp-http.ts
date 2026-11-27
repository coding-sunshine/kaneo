import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { vi } from "vite-plus/test";
import { serve } from "../../../apps/api/node_modules/@hono/node-server";
import type { createApp } from "../../../apps/api/src/index";

type App = ReturnType<typeof createApp>["app"];

const protocolVersion = "2026-07-28";

/**
 * Serves the app on a free loopback port and points hosted MCP tools at it:
 * PORT follows the listener, and every other loopback port is refused, so a
 * tool call never reaches another local stack.
 */
export async function serveForMcpTools(app: App) {
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  vi.stubEnv("PORT", String(port));
  vi.stubEnv("KANEO_INTERNAL_API_URL", "");

  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (loopback && url.port !== String(port)) {
      throw new Error(`blocked loopback call to port ${url.port}`);
    }
    return realFetch(input, init);
  });

  return {
    base: `http://127.0.0.1:${port}`,
    close: async () => {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

/** A tools/call of whoami through POST /api/mcp. */
export async function callWhoami(base: string, token: string) {
  const response = await fetch(`${base}/api/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-method": "tools/call",
      "mcp-name": "whoami",
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "whoami",
        arguments: {},
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "kaneo-integration-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  return { status: response.status, body: await response.text() };
}
