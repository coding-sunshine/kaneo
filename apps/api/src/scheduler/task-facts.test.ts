import { getTableName, type Table } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Slot } from "../topic/controllers/slots";
import { numbered } from "./task-question";
import { textParts } from "./text-parts";

// The database outlives a restart: its rows are kept here, outside the
// modules, which `vi.resetModules` loads afresh. One text is read at a time,
// so the fake answers every query about the progress table with its rows.
const store = vi.hoisted(() => ({
  progress: [] as Record<string, unknown>[],
  statements: [] as Record<string, unknown>[],
  asked: [] as string[],
}));

vi.mock("../database", () => {
  const rowsOf = (table: Table) =>
    getTableName(table) === "task_statement"
      ? store.statements
      : store.progress;
  return {
    default: {
      select: () => ({
        from: (table: Table) => ({ where: async () => [...rowsOf(table)] }),
      }),
      insert: (table: Table) => ({
        values: (
          values: Record<string, unknown> | Record<string, unknown>[],
        ) => {
          const rows = rowsOf(table);
          const write = async () => {
            if (rows === store.progress) rows.length = 0;
            rows.push(...[values].flat());
          };
          return { onConflictDoNothing: write, onConflictDoUpdate: write };
        },
      }),
      delete: (table: Table) => ({
        where: async () => {
          rowsOf(table).length = 0;
        },
      }),
    },
  };
});

vi.mock("../agent/extraction", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../agent/extraction")>()),
  extractJson: vi.fn(async ({ text }: { text: string }) => {
    store.asked.push(text);
    return { topics: [], statements: [] };
  }),
}));

const slot: Slot = {
  id: "s1",
  topicId: "t1",
  key: "price",
  name: "Price",
  type: "number",
  options: null,
  createdBy: null,
  createdAt: new Date(0),
};
const topics = [{ id: "t1", name: "Launch plan", slots: [slot] }];
const run = {
  workspaceId: "ws-1",
  model: "test/model",
  slotsHash: "slots",
  topics,
  asked: numbered(topics),
  upTo: new Date(0),
};
// Five parts, each with its own line number.
const body = Array.from(
  { length: 5000 },
  (_, line) => `Line ${line} of the notes file.`,
).join("\n");
const source = {
  key: "file:a1",
  taskId: "task1",
  assetId: "a1",
  contentHash: "h1",
  head: "Title: Notes\n\nAttached file notes.txt:\n",
  body,
};
const outcome = (parts: number) => ({
  left: 10,
  parts,
  degraded: false,
  stop: false,
});
// A fresh process: no module keeps what the run before held in memory.
const fresh = async () => {
  vi.resetModules();
  return import("./task-parts");
};

beforeEach(() => {
  store.progress.length = 0;
  store.statements.length = 0;
  store.asked.length = 0;
});

describe("reading a file part by part", () => {
  it("goes on after a restart with only the parts that are left", async () => {
    const parts = textParts(body, 12_000, 200);
    expect(parts.length).toBeGreaterThan(3);

    const first = await fresh();
    expect(await first.ask(run, source, outcome(2))).toBe("stop");
    expect(store.asked).toHaveLength(2);

    store.asked.length = 0;
    const second = await fresh();
    expect(await second.ask(run, source, outcome(50))).toEqual({
      readable: true,
    });
    expect(store.asked).toHaveLength(parts.length - 2);
    parts.slice(2).forEach((part, index) => {
      expect(store.asked[index]).toContain(part);
    });
    // A text read to its end leaves no progress behind.
    expect(store.progress).toEqual([]);
  });

  it("keeps the progress of each part that had an answer when the process stops mid-run", async () => {
    const parts = textParts(body, 12_000, 200);
    const first = await fresh();
    const { extractJson } = await import("../agent/extraction");
    // The process stops while the third question is out.
    vi.mocked(extractJson)
      .mockImplementationOnce(async ({ text }) => {
        store.asked.push(text);
        return { topics: [], statements: [] };
      })
      .mockImplementationOnce(async ({ text }) => {
        store.asked.push(text);
        return { topics: [], statements: [] };
      })
      .mockImplementationOnce(() => new Promise(() => {}));
    void first.ask(run, source, outcome(50));
    // Parts go out in batches, so later parts of the batch are asked too; the
    // progress kept is the parts before the one that never came back.
    await vi.waitFor(() =>
      expect(store.asked.length).toBeGreaterThanOrEqual(2),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    store.asked.length = 0;
    const second = await fresh();
    await second.ask(run, source, outcome(50));
    expect(store.asked).toHaveLength(parts.length - 2);
  });
});
