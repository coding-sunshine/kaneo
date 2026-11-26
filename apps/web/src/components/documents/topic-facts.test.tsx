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
import { TopicFacts } from "./topic-facts";

const mocks = vi.hoisted(() => ({
  getTopicFacts: vi.fn(),
  getTrackedFacts: vi.fn(),
  getTopicDependents: vi.fn(),
  trackFact: vi.fn(),
  untrackFact: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { documentId: string };
  }) => <a href={`/document/${params.documentId}`}>{children}</a>,
}));
vi.mock("@/fetchers/document/facts", () => ({}));
vi.mock("@/fetchers/topic/facts", () => mocks);
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const K = "navigation:documents.facts.topic";
const base = {
  slot: "launch",
  slotName: "Launch date",
  type: "date",
  statementId: null,
  value: null,
  quote: null,
  documentId: null,
  documentTitle: null,
  approvedByName: null,
  approvedAt: null,
  proposedIn: [],
};
const stated = {
  ...base,
  statementId: "st-1",
  value: "12 May",
  quote: "We launch on 12 May",
  documentId: "doc-1",
  documentTitle: "Launch plan",
  approvedByName: "Ada",
  approvedAt: "2026-05-01T10:00:00.000Z",
};

const show = (
  answers: unknown[],
  { canManage = true, dependents = [] as unknown[] } = {},
) => {
  mocks.getTopicFacts.mockResolvedValue({ id: "t1", answers });
  mocks.getTrackedFacts.mockResolvedValue(
    answers.map((a) => ({
      id: `id-${(a as { slot: string }).slot}`,
      key: (a as { slot: string }).slot,
    })),
  );
  mocks.getTopicDependents.mockResolvedValue(dependents);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TopicFacts workspaceId="ws" topicId="t1" canManage={canManage} />
    </QueryClientProvider>,
  );
};
const untrackButton = () =>
  screen.findByRole("button", {
    name: `${K}.untrack {"name":"Launch date"}`,
  });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TopicFacts", () => {
  it("tells a manager to track a fact, and a reader who decides", async () => {
    show([]);
    expect(await screen.findByText(`${K}.empty`)).toBeTruthy();
    expect(screen.getByRole("button", { name: `${K}.track` })).toBeTruthy();
    cleanup();
    show([], { canManage: false });
    expect(await screen.findByText(`${K}.emptyReadOnly`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: `${K}.track` })).toBeNull();
  });

  it("shows a stated value with its quote, source and approval", async () => {
    show([stated]);
    expect(await screen.findByText("12 May")).toBeTruthy();
    expect(screen.getByText("We launch on 12 May")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Launch plan" }).getAttribute("href"),
    ).toBe("/document/doc-1");
    expect(screen.getByText(/topic\.approved/)).toBeTruthy();
    expect(screen.queryByText(/topic\.alsoIn/)).toBeNull();
    expect(screen.queryByText(/topic\.reliedOn/)).toBeNull();
  });

  it("says when the topic states no value yet", async () => {
    show([base]);
    expect(await screen.findByText(`${K}.noValue`)).toBeTruthy();
  });

  it("links each proposal that also holds the fact", async () => {
    show([
      {
        ...stated,
        proposedIn: [
          { id: "p1", title: "Draft A" },
          { id: "p2", title: "Draft B" },
        ],
      },
    ]);
    expect(await screen.findByText(/topic\.alsoIn/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Draft B" }).getAttribute("href"),
    ).toBe("/document/p2");
    expect(screen.getByRole("link", { name: "Draft A" })).toBeTruthy();
  });

  it("counts the work that relies on a value, above zero only", async () => {
    show([stated], {
      dependents: [
        { id: "d1", slot: "launch" },
        { id: "d2", slot: "launch" },
      ],
    });
    expect(await screen.findByText(`${K}.reliedOn {"count":2}`)).toBeTruthy();
  });

  it("gives a reader no way to track or untrack", async () => {
    show([stated], { canManage: false });
    await screen.findByText("12 May");
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("asks before untracking, then sends the tracked fact's id", async () => {
    mocks.untrackFact.mockResolvedValue(undefined);
    show([stated]);
    fireEvent.click(await untrackButton());
    fireEvent.click(
      await screen.findByRole("button", { name: `${K}.untrackSubmit` }),
    );
    await waitFor(() =>
      expect(mocks.untrackFact.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "t1",
        slotId: "id-launch",
      }),
    );
  });
});
