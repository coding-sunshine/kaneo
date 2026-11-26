import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { FactNow } from "./fact-now";

const getTopicFacts = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: Record<string, string>;
  }) => <a href={`/document/${params.documentId}`}>{children}</a>,
}));
vi.mock("@/fetchers/topic/facts", () => ({ getTopicFacts }));

const NOW = "navigation:documents.facts.needsReview";
const cause = { topicId: "t1", slot: "price", slotName: "Price" };
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FactNow workspaceId="ws" cause={cause} />
    </QueryClientProvider>,
  );
const show = (answers: unknown[] | null) => {
  getTopicFacts.mockResolvedValue(answers && { id: "t1", answers });
  return mount();
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FactNow", () => {
  it("shows what the topic states now, with its document", async () => {
    show([
      { slot: "date", value: "May 1", documentId: "d1", documentTitle: "Plan" },
      {
        slot: "price",
        value: "60",
        documentId: "d2",
        documentTitle: "Plan v2",
      },
    ]);
    expect(
      (await screen.findByRole("link", { name: "Plan v2" })).getAttribute(
        "href",
      ),
    ).toBe("/document/d2");
    expect(
      screen.getByText(`${NOW}.holdsNow {"name":"Price","value":"60"}`, {
        exact: false,
      }),
    ).toBeTruthy();
    expect(getTopicFacts).toHaveBeenCalledWith("ws", "t1");
  });

  it("says so when the topic states no value any more", async () => {
    show([{ slot: "price", value: null, documentId: null }]);
    expect(
      await screen.findByText(`${NOW}.holdsNothing {"name":"Price"}`),
    ).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows nothing for a topic the reader cannot open", async () => {
    const { container } = show(null);
    await vi.waitFor(() => expect(getTopicFacts).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("claims nothing when the topic's facts are refused", async () => {
    getTopicFacts.mockRejectedValue(new Error("refused"));
    const { container } = mount();
    await vi.waitFor(() => expect(getTopicFacts).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
