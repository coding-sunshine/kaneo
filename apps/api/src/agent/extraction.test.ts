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
  tokensUsedToday: vi.fn(async () => 0),
  recordUsage: vi.fn(async () => undefined),
  spentUsd: vi.fn(async () => 0),
}));

vi.mock("./usage", () => usage);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["statements"],
  properties: { statements: { type: "array", items: { type: "string" } } },
};

const request = {
  purpose: "statements",
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
  usage.spentUsd.mockReset().mockResolvedValue(0);
  vi.stubEnv("EXTRACTION_TOTAL_USD_CAP", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("extractJson", () => {
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

  it("writes the tokens the call used to the usage table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer('{"statements":[]}')),
    );

    await extractJson(request);

    expect(usage.recordUsage).toHaveBeenCalledTimes(1);
    expect(usage.recordUsage).toHaveBeenCalledWith({
      purpose: "statements",
      model: "z-ai/glm-5.3-flash",
      promptTokens: 120,
      completionTokens: 30,
      cost: 0.0002,
    });
  });

  it("makes no call when the day's cap is used up", async () => {
    vi.stubEnv("EXTRACTION_DAILY_TOKEN_CAP", "1000");
    usage.tokensUsedToday.mockResolvedValue(1000);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toBeNull();
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

  it("makes no call when the total spend has reached its cap", async () => {
    vi.stubEnv("EXTRACTION_TOTAL_USD_CAP", "5");
    usage.spentUsd.mockResolvedValue(5);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls while the total spend is under its cap", async () => {
    vi.stubEnv("EXTRACTION_TOTAL_USD_CAP", "5");
    usage.spentUsd.mockResolvedValue(4.99);
    const fetchMock = vi.fn(async () => answer('{"statements":[]}'));
    vi.stubGlobal("fetch", fetchMock);

    expect(await extractJson(request)).toEqual({ statements: [] });
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
