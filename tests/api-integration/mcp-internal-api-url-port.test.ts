import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

const protocolVersion = "2026-07-28";

type Server = ReturnType<typeof serve>;
let server: Server | undefined;

async function listen() {
  const { app } = createApp();
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  if (!server.listening) await once(server, "listening");
  return (server.address() as AddressInfo).port;
}

// Tool calls go back into the API over loopback. Refuse every loopback port
// but the one this test listens on, so a wrong default never reaches another
// local stack.
function onlyLoopbackPort(port: number) {
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (loopback && url.port !== String(port)) {
      throw new Error(`blocked loopback call to port ${url.port}`);
    }
    return realFetch(input, init);
  });
}

async function signUp(base: string) {
  const response = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      name: "MCP port user",
      email: `mcp-port-${crypto.randomUUID()}@example.com`,
      password: "mcp-port-user-password",
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    token: string;
    user: { id: string; email: string };
  };
}

async function callWhoami(base: string, token: string) {
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
            name: "kaneo-port-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  return { status: response.status, body: await response.text() };
}

describe("API integration: hosted MCP internal URL", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    const closing = server;
    server = undefined;
    if (closing) {
      await new Promise<void>((resolve, reject) =>
        closing.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("calls tools through the port the API listens on when no internal URL is set", async () => {
    const port = await listen();
    vi.stubEnv("PORT", String(port));
    vi.stubEnv("KANEO_INTERNAL_API_URL", "");
    onlyLoopbackPort(port);
    const base = `http://127.0.0.1:${port}`;
    const { token, user } = await signUp(base);

    const result = await callWhoami(base, token);

    expect(result.status).toBe(200);
    expect(result.body).not.toMatch(/Unauthorized|blocked loopback/);
    expect(result.body).toContain(user.email);
  });
});
