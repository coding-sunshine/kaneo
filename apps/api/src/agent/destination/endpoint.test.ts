import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createCompletion,
  DEFAULT_AGENT_MODEL,
  OPENROUTER_URL,
} from "../openrouter";
import { defaultDestination, endpointFor } from "./endpoint";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const serverHas = (key: string, selfHosted: string) => {
  vi.stubEnv("OPENROUTER_API_KEY", key);
  vi.stubEnv("AI_SELF_HOSTED_URL", selfHosted);
  vi.stubEnv("AI_SELF_HOSTED_API_KEY", "");
  vi.stubEnv("AGENT_MODEL", "");
};

// Sends one completion through a fake model server and returns the request.
async function sent(destination: Parameters<typeof endpointFor>[0]) {
  const fetchMock = vi.fn(
    async () =>
      new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'),
  );
  vi.stubGlobal("fetch", fetchMock);
  await createCompletion(
    [],
    [],
    undefined,
    undefined,
    endpointFor(destination),
  );
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    { headers: Record<string, string>; body: string },
  ];
  return { url, headers: init.headers, body: JSON.parse(init.body) };
}

describe("AI destination", () => {
  it("sends OpenRouter calls with the server key and its routing", async () => {
    serverHas("or-key", "");
    const request = await sent({ provider: "openrouter", model: null });
    expect(request.url).toBe(OPENROUTER_URL);
    expect(request.headers.Authorization).toBe("Bearer or-key");
    expect(request.body.model).toBe(DEFAULT_AGENT_MODEL);
    expect(request.body.provider).toMatchObject({ data_collection: "deny" });
  });

  it("sends self-hosted calls to the server's URL with the chosen model, never the OpenRouter key", async () => {
    serverHas("or-key", "http://models.internal/v1/");
    const request = await sent({ provider: "self-hosted", model: "local-llm" });
    expect(request.url).toBe("http://models.internal/v1/chat/completions");
    expect(request.body.model).toBe("local-llm");
    expect(request.body.provider).toBeUndefined();
    expect(JSON.stringify(request.headers)).not.toContain("or-key");
  });

  it("uses the self-hosted key only for the self-hosted server", async () => {
    serverHas("", "http://models.internal/v1");
    vi.stubEnv("AI_SELF_HOSTED_API_KEY", "local-key");
    const request = await sent({ provider: "self-hosted", model: "local-llm" });
    expect(request.headers.Authorization).toBe("Bearer local-key");
  });

  it("refuses, and never falls back to OpenRouter, when self-hosted is chosen but not configured", () => {
    serverHas("or-key", "");
    expect(() =>
      endpointFor({ provider: "self-hosted", model: "local-llm" }),
    ).toThrow(/self-hosted/i);
  });

  it("refuses OpenRouter when the server has no key", () => {
    serverHas("", "http://models.internal/v1");
    expect(() => endpointFor({ provider: "openrouter", model: null })).toThrow(
      /OpenRouter/,
    );
  });

  it("defaults to OpenRouter with a key, else to the self-hosted server", () => {
    serverHas("or-key", "http://models.internal/v1");
    expect(defaultDestination().provider).toBe("openrouter");
    serverHas("", "http://models.internal/v1");
    expect(defaultDestination().provider).toBe("self-hosted");
  });
});
