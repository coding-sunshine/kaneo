import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createCompletion } from "./openrouter";

const sse = (...chunks: object[]) =>
  new Response(
    [
      ...chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`),
      "data: [DONE]\n\n",
    ].join(""),
  );

afterEach(() => vi.unstubAllGlobals());

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
});
