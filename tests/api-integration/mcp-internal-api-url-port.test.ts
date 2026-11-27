import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { callWhoami, serveForMcpTools } from "./helpers/mcp-http";

let close: (() => Promise<void>) | undefined;

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

describe("API integration: hosted MCP internal URL", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it("calls tools through the port the API listens on when no internal URL is set", async () => {
    const served = await serveForMcpTools(createApp().app);
    close = served.close;
    const { token, user } = await signUp(served.base);

    const result = await callWhoami(served.base, token);

    expect(result.status).toBe(200);
    expect(result.body).not.toMatch(/Unauthorized|blocked loopback/);
    expect(result.body).toContain(user.email);
  });
});
