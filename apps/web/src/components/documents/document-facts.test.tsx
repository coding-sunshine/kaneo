import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentFacts } from "./document-facts";

const mocks = vi.hoisted(() => ({
  getDocumentReceipt: vi.fn(),
  getDocumentFacts: vi.fn(),
  confirmDocumentFact: vi.fn(),
  addDocumentFact: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/topic">{children}</a>
  ),
}));
vi.mock("@/fetchers/document/facts", () => mocks);
vi.mock("@/fetchers/topic/facts", () => ({}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./fact-conflict-card", () => ({
  FactConflictCard: ({ conflict }: { conflict: { slotName: string } }) => (
    <div>conflict card {conflict.slotName}</div>
  ),
}));
vi.mock("./reject-fact-dialog", () => ({
  RejectFactDialog: ({ fact }: { fact: { slotName: string } }) => (
    <div>reject dialog {fact.slotName}</div>
  ),
}));

const T = "navigation:documents.facts";
const stated = (id: string, name: string, confirmed = false) => ({
  statementId: id,
  slot: `slot-${id}`,
  slotName: name,
  type: "date",
  value: "5 March",
  quote: "on 5 March",
  confirmed,
});
const receipt = (over: Record<string, unknown> = {}) => ({
  conflicts: [],
  unjudged: [],
  new: [],
  repeats: [],
  notChecked: [],
  ...over,
});

type Props = Partial<Parameters<typeof DocumentFacts>[0]>;
const show = async (
  data: unknown,
  props: Props = {},
  facts: unknown[] = [],
) => {
  mocks.getDocumentReceipt.mockResolvedValue(data);
  mocks.getDocumentFacts.mockResolvedValue(facts);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentFacts
        document={
          {
            workspaceId: "ws",
            id: "doc",
            status: "proposal",
            topicId: "t1",
          } as never
        }
        topic={{ id: "t1", canDecide: true, deciderName: "Ann" }}
        canEdit
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { level: 2 });
};
const current = {
  document: {
    workspaceId: "ws",
    id: "doc",
    status: "current",
    topicId: "t1",
  } as never,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentFacts", () => {
  it("shows the no-topic text and asks for nothing", async () => {
    await show(receipt(), { topic: null });
    expect(screen.getByText(`${T}.noTopic`)).toBeTruthy();
    expect(mocks.getDocumentReceipt).not.toHaveBeenCalled();
    expect(mocks.getDocumentFacts).not.toHaveBeenCalled();
  });

  it("says no facts are tracked and links to the topic", async () => {
    await show(receipt());
    expect(await screen.findByText(`${T}.noFacts`)).toBeTruthy();
    expect(screen.getByRole("link", { name: `${T}.openTopic` })).toBeTruthy();
  });

  it("shows the proposal groups", async () => {
    await show(
      receipt({
        conflicts: [{ ...stated("c", "Price"), status: "open" }],
        new: [stated("n", "Launch")],
        notChecked: [{ slot: "s", slotName: "Owner", type: "person" }],
      }),
    );
    expect(await screen.findByText(`${T}.intro.proposal`)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: `${T}.groups.conflicts 1` }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: `${T}.groups.new 1` }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: `${T}.groups.notChecked 1` }),
    ).toBeTruthy();
    expect(screen.getByText("conflict card Price")).toBeTruthy();
  });

  it("shows waiting and stated on the current document", async () => {
    await show(
      receipt({
        new: [stated("n", "Launch")],
        repeats: [stated("r", "Price", true)],
      }),
      current,
    );
    expect(await screen.findByText(`${T}.intro.current`)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: `${T}.groups.waiting 1` }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: `${T}.groups.stated 1` }),
    ).toBeTruthy();
  });

  it("confirms a fact", async () => {
    mocks.confirmDocumentFact.mockResolvedValue({});
    await show(receipt({ new: [stated("n", "Launch")] }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: `${T}.confirmName {"name":"Launch"}`,
      }),
    );
    await waitFor(() =>
      expect(mocks.confirmDocumentFact.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "doc",
        statementId: "n",
      }),
    );
  });

  it("opens the reject dialog", async () => {
    await show(receipt({ new: [stated("n", "Launch")] }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: `${T}.rejectName {"name":"Launch"}`,
      }),
    );
    expect(screen.getByText("reject dialog Launch")).toBeTruthy();
  });

  it("hides the buttons from a reader", async () => {
    await show(receipt({ new: [stated("n", "Launch")] }), { canEdit: false });
    await screen.findByText(`${T}.intro.proposal`);
    expect(
      screen.queryByRole("button", { name: /confirmName|rejectName/ }),
    ).toBeNull();
    expect(screen.queryByText(`${T}.deciderOnly`)).toBeNull();
  });

  it("tells an editor who is not the decider on the current document", async () => {
    await show(receipt({ new: [stated("n", "Launch")] }), {
      ...current,
      topic: { id: "t1", canDecide: false, deciderName: "Ann" },
    });
    expect(await screen.findByText(`${T}.deciderOnly`)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /confirmName|rejectName/ }),
    ).toBeNull();
  });

  it("offers no add to an editor who is not the decider on the current document", async () => {
    const missing = receipt({
      notChecked: [{ slot: "s", slotName: "Owner", type: "person" }],
    });
    await show(missing, {
      ...current,
      topic: { id: "t1", canDecide: false, deciderName: "Ann" },
    });
    await screen.findByText(`${T}.deciderOnly`);
    expect(
      screen.queryByRole("button", { name: `${T}.addName {"name":"Owner"}` }),
    ).toBeNull();
    cleanup();

    await show(missing, current);
    expect(
      await screen.findByRole("button", {
        name: `${T}.addName {"name":"Owner"}`,
      }),
    ).toBeTruthy();
  });

  it("shows the rejected value of a missing fact", async () => {
    await show(
      receipt({
        notChecked: [{ slot: "s", slotName: "Owner", type: "person" }],
      }),
      {},
      [
        {
          id: "x",
          slot: "s",
          status: "rejected",
          value: "Bob",
          statusReason: "wrong",
          createdAt: "2026-01-01",
        },
        {
          id: "y",
          slot: "s",
          status: "rejected",
          value: "Cy",
          statusReason: "old",
          createdAt: "2025-01-01",
        },
      ],
    );
    expect(
      await screen.findByText(
        `${T}.rejectedLine {"value":"Bob","reason":"wrong"}`,
      ),
    ).toBeTruthy();
  });

  it("adds a value once the quote has 4 characters", async () => {
    mocks.addDocumentFact.mockResolvedValue({});
    await show(
      receipt({
        notChecked: [{ slot: "s", slotName: "Owner", type: "person" }],
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: `${T}.addName {"name":"Owner"}`,
      }),
    );
    fireEvent.change(screen.getByLabelText(`${T}.valueLabel`), {
      target: { value: " Ann " },
    });
    const submit = screen.getByRole("button", {
      name: `${T}.addSubmit`,
    }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(`${T}.quoteLabel`), {
      target: { value: " abc " },
    });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(`${T}.quoteLabel`), {
      target: { value: " abcd " },
    });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(mocks.addDocumentFact.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "doc",
        slot: "s",
        value: "Ann",
        quote: "abcd",
      }),
    );
  });
});
