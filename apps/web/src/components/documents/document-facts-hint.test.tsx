import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentFactsHint } from "./document-facts-hint";

const mocks = vi.hoisted(() => ({ getDocumentReceipt: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/facts", () => ({
  getDocumentReceipt: mocks.getDocumentReceipt,
}));
vi.mock("@/fetchers/topic/facts", () => ({}));

const HINT = "navigation:documents.facts.hint";
const fact = (confirmed: boolean) => ({ confirmed });
const receipt = (over: Record<string, unknown>) => ({
  conflicts: [],
  unjudged: [],
  new: [],
  repeats: [],
  notChecked: [],
  ...over,
});

const show = async (
  data: ReturnType<typeof receipt>,
  { canConfirm = true, onOpen = vi.fn() } = {},
) => {
  mocks.getDocumentReceipt.mockResolvedValue(data);
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentFactsHint
        canConfirm={canConfirm}
        onOpen={onOpen}
        document={{ workspaceId: "ws", id: "doc", topicId: "topic" }}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mocks.getDocumentReceipt).toHaveBeenCalled());
  return view;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentFactsHint", () => {
  it("says nothing without conflicts or waiting facts", async () => {
    const { container } = await show(receipt({ new: [fact(true)] }));
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });

  it("tells a reader about open conflicts only", async () => {
    await show(
      receipt({
        conflicts: [
          { ...fact(false), status: "open" },
          { ...fact(false), status: "settled" },
        ],
        new: [fact(false)],
      }),
      { canConfirm: false },
    );
    expect(
      await screen.findByText(`${HINT}.conflicts {"count":1}`),
    ).toBeTruthy();
    expect(screen.queryByText(new RegExp(`${HINT}.waiting`))).toBeNull();
  });

  it("shows the waiting line only to who can confirm, and opens the panel", async () => {
    const onOpen = vi.fn();
    await show(receipt({ new: [fact(false), fact(false)] }), { onOpen });
    expect(await screen.findByText(`${HINT}.waiting {"count":2}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `${HINT}.review` }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("hides the waiting line from a reader", async () => {
    const { container } = await show(receipt({ new: [fact(false)] }), {
      canConfirm: false,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });
});
