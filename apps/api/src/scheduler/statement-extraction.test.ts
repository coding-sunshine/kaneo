import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const store = vi.hoisted(() => ({
  documents: [] as Record<string, unknown>[],
  recorded: [] as Record<string, unknown>[],
}));

const model = vi.hoisted(() => ({
  extractJson: vi.fn(),
  proposeStatements: vi.fn(),
}));

vi.mock("../database", () => ({
  default: {
    select: () => {
      const chain = {
        from: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: async () => [...store.documents],
      };
      return chain;
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: async () => {
          store.recorded.push(values);
        },
      }),
    }),
  },
}));

vi.mock("../agent/openrouter", () => ({ isAgentEnabled: () => true }));

vi.mock("../agent/extraction", () => ({
  extractJson: model.extractJson,
  extractionModel: () => "test-model",
  UnreadableAnswer: class extends Error {},
}));

const SLOT = {
  id: "slot-1",
  key: "launch_date",
  name: "Launch date",
  type: "date",
  options: null,
  createdAt: new Date(0),
};

vi.mock("../topic/controllers/slots", () => ({
  slotsOf: async () => new Map([["topic-1", [SLOT]]]),
  slotsHash: () => "slots-hash",
}));

vi.mock("../topic/controllers/statements", () => ({
  proposeStatements: model.proposeStatements,
}));

const { extractFiledDocuments } = await import("./statement-extraction");

const document = (id: string, workspaceId: string, updatedAt: Date) => ({
  id,
  workspaceId,
  content: `<p>${id} launches on 5 March 2027.</p>`,
  contentHash: `${id}-hash`,
  topicId: "topic-1",
  updatedAt,
  since: null,
});

const HOUR_AGO = () => new Date(Date.now() - 60 * 60_000);

beforeEach(() => {
  store.documents = [];
  store.recorded = [];
  model.extractJson.mockReset();
  model.proposeStatements.mockReset().mockResolvedValue([]);
});

describe("extractFiledDocuments", () => {
  it("skips a document edited just now", async () => {
    store.documents = [
      document("fresh", "ws-1", new Date()),
      document("settled", "ws-1", HOUR_AGO()),
    ];
    model.extractJson.mockResolvedValue({ statements: [] });

    await extractFiledDocuments();

    expect(model.extractJson).toHaveBeenCalledTimes(1);
    expect(model.extractJson.mock.calls[0]?.[0].text).toContain("settled");
    expect(store.recorded.map((row) => row.documentId)).toEqual(["settled"]);
  });

  it("reads the next workspace when one has used its daily token cap", async () => {
    store.documents = [
      document("capped", "ws-capped", HOUR_AGO()),
      document("open", "ws-open", HOUR_AGO()),
    ];
    model.extractJson.mockImplementation(
      async (request: { workspaceId: string }) =>
        request.workspaceId === "ws-capped" ? null : { statements: [] },
    );

    await extractFiledDocuments();

    expect(
      model.extractJson.mock.calls.map(([request]) => request.workspaceId),
    ).toEqual(["ws-capped", "ws-open"]);
    expect(store.recorded.map((row) => row.documentId)).toEqual(["open"]);
  });
});
