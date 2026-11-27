import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

type AppModule = typeof import("../../apps/api/src/index");
type AuthModule = typeof import("../../apps/api/src/auth");

let app: ReturnType<AppModule["createApp"]>["app"];
let auth: AuthModule["auth"];

// The auth instance reads its settings at import, so this file imports it
// after clearing the variables a self-hosted instance leaves unset.
beforeAll(async () => {
  delete process.env.KANEO_CLOUD;
  delete process.env.DISABLE_AUTH_RATE_LIMIT;
  vi.resetModules();
  ({ auth } = await import("../../apps/api/src/auth"));
  ({ app } = (await import("../../apps/api/src/index")).createApp());
});

function signIn() {
  return app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "nobody@example.test",
      password: "wrong-password-123",
    }),
  });
}

describe("sign-in rate limiting on a self-hosted instance", () => {
  it("is enabled when KANEO_CLOUD is unset", () => {
    expect(auth.options.rateLimit?.enabled).toBe(true);
  });

  it("refuses repeated sign-in attempts with 429", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      statuses.push((await signIn()).status);
    }
    expect(statuses.slice(0, 3)).not.toContain(429);
    expect(statuses[3]).toBe(429);
  });
});
