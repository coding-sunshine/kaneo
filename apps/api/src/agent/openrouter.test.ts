import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createCompletion,
  DEFAULT_AGENT_HOST,
  DEFAULT_AGENT_MODEL,
} from "./openrouter";

const sse = (...chunks: object[]) =>
  new Response(
    [
      ...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`),
      "data: [DONE]\n\n",
    ].join(""),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const sentBody = async () => {
  const fetchMock = vi.fn(async () =>
    sse({ choices: [{ delta: { content: "ok" } }] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await createCompletion([], []);
  return JSON.parse(
    (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
  );
};

describe("createCompletion", () => {
  it("streams text and joins tool call fragments", async () => {
    const fetchMock = vi.fn(async () =>
      sse(
        { choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo" } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "c1",
                    function: { name: "list_", arguments: '{"a"' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { name: "projects", arguments: ":1}" },
                  },
                ],
              },
            },
          ],
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const deltas: string[] = [];
    const message = await createCompletion([], [], (d) => deltas.push(d));
    expect(deltas).toEqual(["Hel", "lo"]);
    expect(message).toEqual({
      role: "assistant",
      content: "Hello",
      tool_calls: [
        {
          id: "c1",
          type: "function",
          function: { name: "list_projects", arguments: '{"a":1}' },
        },
      ],
    });
    const sent = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1]
        .body,
    );
    expect(sent).toMatchObject({
      stream: true,
      provider: { data_collection: "deny" },
    });
  });

  it("pins the default model to the host that passed the synthetic test", async () => {
    vi.stubEnv("AGENT_MODEL", "");
    vi.stubEnv("AGENT_HOST", "");
    expect(await sentBody()).toMatchObject({
      model: DEFAULT_AGENT_MODEL,
      provider: {
        data_collection: "deny",
        order: [DEFAULT_AGENT_HOST],
        allow_fallbacks: false,
      },
    });
  });

  it("does not pin another model to that host", async () => {
    vi.stubEnv("AGENT_MODEL", "other/model");
    vi.stubEnv("AGENT_HOST", "");
    const body = await sentBody();
    expect(body.model).toBe("other/model");
    expect(body.provider).toEqual({ data_collection: "deny" });
  });

  it("pins to AGENT_HOST when it is set", async () => {
    vi.stubEnv("AGENT_MODEL", "other/model");
    vi.stubEnv("AGENT_HOST", "some-host/fp8");
    expect((await sentBody()).provider).toEqual({
      data_collection: "deny",
      order: ["some-host/fp8"],
      allow_fallbacks: false,
    });
  });
});
