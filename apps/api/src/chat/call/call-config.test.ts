import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

const load = () => import("./call-config");
const configure = (values: Record<string, string>) => {
  for (const name of [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "LIVEKIT_API_SECRET_FILE",
  ])
    vi.stubEnv(name, values[name] ?? "");
};

describe("call config", () => {
  it("is off until the URL, key and secret are all set", async () => {
    const { callsConfigured, readCallConfig } = await load();
    configure({ LIVEKIT_URL: "wss://calls.example.test" });
    expect(callsConfigured()).toBe(false);
    expect(readCallConfig()).toBeNull();

    configure({
      LIVEKIT_URL: "wss://calls.example.test",
      LIVEKIT_API_KEY: "fake-key",
      LIVEKIT_API_SECRET: "fake-secret",
    });
    expect(callsConfigured()).toBe(true);
    expect(readCallConfig()).toEqual({
      url: "wss://calls.example.test",
      apiKey: "fake-key",
      apiSecret: "fake-secret",
    });
  });

  it("counts a secret file as set without reading it", async () => {
    const { callsConfigured } = await load();
    configure({
      LIVEKIT_URL: "wss://calls.example.test",
      LIVEKIT_API_KEY: "fake-key",
      LIVEKIT_API_SECRET_FILE: "/missing/secret",
    });
    expect(callsConfigured()).toBe(true);
  });

  it("says once that calls are off", async () => {
    const { logCallsOffOnce } = await load();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    logCallsOffOnce();
    logCallsOffOnce();
    expect(info).toHaveBeenCalledOnce();
    expect(String(info.mock.calls[0]?.[0])).toContain("Calls are off");
    expect(String(info.mock.calls[0]?.[0])).toContain("LIVEKIT_API_SECRET");
  });
});
