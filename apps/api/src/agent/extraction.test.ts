import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { extractJson } from "./extraction";
import { DEFAULT_AGENT_MODEL } from "./openrouter";

const usage = vi.hoisted(() => ({
  tokensUsedToday: vi.fn(async (_workspaceId: string) => 0),
  recordUsage: vi.fn(async () => undefined),
  withinMonthlyCap: vi.fn(async (_share?: number) => true),
}));

vi.mock("./usage", () => usage);

// The workspace's AI data destination, without a database.
const destination = vi.hoisted(() => ({
  current: { provider: "openrouter", model: null } as {
    provider: "openrouter" | "self-hosted";
    model: string | null;
  },
}));
vi.mock("./destination/store", async () => {
  const { endpointFor } = await import("./destination/endpoint");
  return { workspaceEndpoint: async () => endpointFor(destination.current) };
});

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["statements"],
  properties: { statements: { type: "array", items: { type: "string" } } },
};

const request = {
  purpose: "statements",
  workspaceId: "ws-1",
  system: "Report the facts.",
  text: "Go-live is 14 March.",
  schema,
};

const answer = (content: string, tokens = { prompt: 120, completion: 30 }) =>
  new Response(
    JSON.stringify({
      model: "z-ai/glm-5.3-flash",
      choices: [{ message: { content } }],
      usage: {
        prompt_tokens: tokens.prompt,
        completion_tokens: tokens.completion,
        total_tokens: tokens.prompt + tokens.completion,
        cost: 0.0002,
      },
    }),
  );

const sent = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse(
    (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
  );

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("AGENT_MODEL", "");
  vi.stubEnv("EXTRACTION_MODEL", "");
  vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "");
  usage.tokensUsedToday.mockReset().mockResolvedValue(0);
  usage.recordUsage.mockReset().mockResolvedValue(undefined);
  usage.withinMonthlyCap.mockReset().mockResolvedValue(true);
  destination.current = { provider: "openrouter", model: null };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("extractJson", () => {
  it("reads a self-hosted workspace's text only on its own model server, without OpenRouter fields", async () => {
    vi.stubEnv("AI_SELF_HOSTED_URL", "http://models.internal/v1");
    destination.current = { provider: "self-hosted", model: "local-llm" };
    const fetchMock = vi.fn(async () => answer('{"statements":[]}'));
    vi.stubGlobal("fetch", fetchMock);

    await extractJson(request);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe("http://models.internal/v1/chat/completions");
    expect(JSON.stringify(init.headers)).not.toContain("test-key");
    const body = sent(fetchMock);
    expect(body.model).toBe("local-llm");
    expect(body.provider).toBeUndefined();
    expect(body.plugins).toBeUndefined();
  });

  it("skips a self-hosted workspace's files, and a destination the server cannot serve", async () => {
    vi.stubEnv("AI_SELF_HOSTED_URL", "http://models.internal/v1");
    destination.current = { provider: "self-hosted", model: "local-llm" };
    const fetchMock = vi.fn(async () => answer('{"statements":[]}'));
    vi.stubGlobal("fetch", fetchMock);
    const file = {
      bytes: new Uint8Array([1]),
      mimeType: "application/pdf",
      filename: "a.pdf",
    };
    expect(await extractJson({ ...request, file })).toBeNull();
    vi.stubEnv("AI_SELF_HOSTED_URL", "");
    expect(await extractJson(request)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks once, without streaming, with zero data retention and a strict schema", async () => {
    const fetchMock = vi.fn(async () =>
      answer('{"statements":["Go-live is 14 March."]}'),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractJson<{ statements: string[] }>(request);

    expect(result).toEqual({ statements: ["Go-live is 14 March."] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sent(fetchMock);
    expect(body.stream).toBe(false);
    expect(body.provider).toEqual({
      data_collection: "deny",
      zdr: true,
      require_parameters: true,
    });
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.max_tokens).toBeLessThanOrEqual(2000);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "statements", strict: true, schema },
    });
    expect(body.messages).toEqual([
      { role: "system", content: "Report the facts." },
      { role: "user", content: "Go-live is 14 March." },
    ]);
    expect(body.tools).toBeUndefined();
  });

  it("sends the model set for reading documents, else the assistant's, else the default", async () => {
    const fetchMock = vi.fn(async () => answer('{"statements":[]}'));
    vi.stubGlobal("fetch", fetchMock);
    const model = async () => {
      fetchMock.mockClear();
      await extractJson(request);
      return sent(fetchMock).model;
    };

    expect(await model()).toBe(DEFAULT_AGENT_MODEL);
    vi.stubEnv("AGENT_MODEL", "assistant/model");
    expect(await model()).toBe("assistant/model");
    vi.stubEnv("EXTRACTION_MODEL", "reader/model");
    expect(await model()).toBe("reader/model");
  });

  it("writes the tokens the call used to the usage table, under its workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer('{"statements":[]}')),
    );

    await extractJson(request);

    expect(usage.recordUsage).toHaveBeenCalledTimes(1);
    expect(usage.recordUsage).toHaveBeenCalledWith({
      purpose: "statements",
      workspaceId: "ws-1",
      model: "z-ai/glm-5.3-flash",
      promptTokens: 120,
      completionTokens: 30,
      cost: 0.0002,
    });
  });

  it("makes no call when the workspace's day cap is used up", async () => {
    vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "1000");
    usage.tokensUsedToday.mockResolvedValue(1000);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toBeNull();
    expect(usage.tokensUsedToday).toHaveBeenCalledWith("ws-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usage.recordUsage).not.toHaveBeenCalled();
  });

  it("calls while the day is under its cap", async () => {
    vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "1000");
    usage.tokensUsedToday.mockResolvedValue(999);
    const fetchMock = vi.fn(async () => answer('{"statements":[]}'));
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toEqual({ statements: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes no call when this month's spend has reached its cap", async () => {
    usage.withinMonthlyCap.mockResolvedValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks for its share of this month's cap", async () => {
    const fetchMock = vi.fn(async () => answer('{"statements":[]}'));
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson({ ...request, reserve: 0.2 })).toEqual({
      statements: [],
    });
    expect(usage.withinMonthlyCap).toHaveBeenCalledWith(0.8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes no call and reads no usage without a key", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usage.tokensUsedToday).not.toHaveBeenCalled();
  });

  it("fails on a refused request and records nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no endpoint", { status: 404 })),
    );

    await expect(extractJson(request)).rejects.toThrow("HTTP 404");
    expect(usage.recordUsage).not.toHaveBeenCalled();
  });

  it("still records the tokens of an answer it cannot read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer("not json")),
    );

    await expect(extractJson(request)).rejects.toThrow();
    expect(usage.recordUsage).toHaveBeenCalledTimes(1);
  });
});
