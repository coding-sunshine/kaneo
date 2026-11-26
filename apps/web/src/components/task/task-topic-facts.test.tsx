import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";
import { TaskTopicFacts } from "./task-topic-facts";

const mocks = vi.hoisted(() => ({
  getTopicDependents: vi.fn(),
  getTopicFacts: vi.fn(),
  getNeedsReview: vi.fn(),
  clearNeedsReview: vi.fn(),
  addFactDependent: vi.fn(),
  removeFactDependent: vi.fn(),
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
    <a href="/doc">{children}</a>
  ),
}));
vi.mock("@/fetchers/topic/facts", () => ({
  getTopicDependents: mocks.getTopicDependents,
  getTopicFacts: mocks.getTopicFacts,
  getNeedsReview: mocks.getNeedsReview,
  clearNeedsReview: mocks.clearNeedsReview,
}));
vi.mock("@/fetchers/document/facts", () => ({
  addFactDependent: mocks.addFactDependent,
  removeFactDependent: mocks.removeFactDependent,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const R = "navigation:documents.facts.relies";
const item = (name: string, value: string) =>
  `${R}.item ${JSON.stringify({ name, value })}`;
const dependent = (over = {}) => ({
  id: "dep-1",
  statementId: "s1",
  slot: "sl1",
  slotName: "Launch date",
  value: "May 1",
  statedIn: "doc-1",
  needsReview: false,
  task: { id: "task-1" },
  document: null,
  ...over,
});
const answer = (over = {}) => ({
  slot: "sl2",
  slotName: "Price",
  statementId: "s2",
  value: "$9",
  documentId: "doc-2",
  ...over,
});

const show = ({
  dependents = [] as unknown[],
  answers = [] as unknown[],
  flagged = [] as unknown[],
} = {}) => {
  mocks.getTopicDependents.mockResolvedValue(dependents);
  mocks.getTopicFacts.mockResolvedValue({ id: "t1", answers });
  mocks.getNeedsReview.mockResolvedValue(flagged);
  mocks.removeFactDependent.mockResolvedValue({});
  mocks.addFactDependent.mockResolvedValue({});
  mocks.clearNeedsReview.mockResolvedValue({});
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TaskTopicFacts workspaceId="ws" taskId="task-1" topicId="t1" />
    </QueryClientProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskTopicFacts", () => {
  it("renders nothing with no relied values and no choices", async () => {
    const { container } = show();
    await vi.waitFor(() => expect(mocks.getTopicFacts).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.innerHTML).toBe("");
  });

  it("shows a relied value and removes it", async () => {
    show({ dependents: [dependent()] });
    expect(await screen.findByText(item("Launch date", "May 1"))).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: `${R}.remove {"name":"Launch date"}`,
      }),
    );
    await vi.waitFor(() =>
      expect(mocks.removeFactDependent.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "doc-1",
        statementId: "s1",
        dependencyId: "dep-1",
      }),
    );
  });

  it("leaves out another issue's link", async () => {
    show({
      dependents: [
        dependent(),
        dependent({
          id: "dep-2",
          slotName: "Venue",
          value: "Pier",
          task: { id: "task-2" },
        }),
      ],
    });
    await screen.findByText(item("Launch date", "May 1"));
    expect(screen.queryByText(item("Venue", "Pier"))).toBeNull();
  });

  it("shows the flag with its date and the value now, and clears it", async () => {
    const { container } = show({
      dependents: [dependent({ needsReview: true })],
      answers: [answer({ slot: "sl1", statementId: "s9", value: "June 9" })],
      flagged: [
        {
          id: "dep-1",
          flaggedAt: "2026-03-04T10:00:00.000Z",
          cause: { topicId: "t1", slot: "sl1", slotName: "Launch date" },
        },
      ],
    });
    await screen.findByText(
      (text) =>
        text.includes(`${R}.flag`) &&
        text.includes(formatDateMedium("2026-03-04T10:00:00.000Z")),
    );
    expect(container.textContent).toContain(
      'holdsNow {"name":"Launch date","value":"June 9"}',
    );
    fireEvent.click(screen.getByRole("button", { name: `${R}.clear` }));
    await vi.waitFor(() =>
      expect(mocks.clearNeedsReview.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        dependencyId: "dep-1",
      }),
    );
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(`${R}.clearDone`),
    );
  });

  it("offers only values not yet relied on, and adds the chosen one", async () => {
    show({
      dependents: [dependent()],
      answers: [
        answer({
          slotName: "Launch date",
          statementId: "s1",
          value: "May 1",
          documentId: "doc-1",
        }),
        answer(),
        answer({ statementId: null, slotName: "Empty" }),
      ],
    });
    await screen.findByText(item("Launch date", "May 1"));
    fireEvent.click(screen.getByRole("button", { name: `${R}.add` }));
    expect(
      await screen.findByRole("menuitem", { name: item("Price", "$9") }),
    ).toBeTruthy();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    fireEvent.click(screen.getByRole("menuitem"));
    await vi.waitFor(() =>
      expect(mocks.addFactDependent.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "doc-2",
        statementId: "s2",
        taskId: "task-1",
      }),
    );
  });
});
