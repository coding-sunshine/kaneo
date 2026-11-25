import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Topic } from "@/fetchers/topic/topics";
import { TopicSuggestions } from "./topic-suggestions";

const mocks = vi.hoisted(() => ({ getTopics: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/topic/topics", () => ({ getTopics: mocks.getTopics }));

const topic = (over: Partial<Topic>) =>
  ({
    id: "t1",
    name: "Launch plan",
    currentDocumentId: "d1",
    currentDocumentTitle: "Launch plan v2",
    ...over,
  }) as Topic;

const onPick = vi.fn();
const show = (title: string, picked: Topic | null = null) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = (t: string, p: Topic | null) => (
    <QueryClientProvider client={client}>
      <TopicSuggestions workspaceId="ws" title={t} picked={p} onPick={onPick} />
    </QueryClientProvider>
  );
  const view = render(ui(title, picked));
  return (t: string, p: Topic | null) => view.rerender(ui(t, p));
};
const settle = () => new Promise((done) => setTimeout(done, 450));

describe("TopicSuggestions", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks nothing under three characters", async () => {
    show("Bo");
    await settle();
    expect(mocks.getTopics).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the name and the current document, and picks", async () => {
    const found = topic({});
    mocks.getTopics.mockResolvedValue([found]);
    show("Launch plan");
    await settle();
    expect(mocks.getTopics).toHaveBeenCalledWith("ws", "Launch plan");
    expect(
      screen.getByText("navigation:documents.taskTopic.matches"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'navigation:documents.taskTopic.current {"title":"Launch plan v2"}',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Launch plan/ }));
    expect(onPick).toHaveBeenCalledWith(found);
  });

  it("says when the current document cannot be opened", async () => {
    mocks.getTopics.mockResolvedValue([topic({ currentDocumentTitle: null })]);
    show("Launch plan");
    await settle();
    expect(
      screen.getByText("navigation:documents.taskTopic.cannotOpen"),
    ).toBeTruthy();
  });

  it("shows at most three topics", async () => {
    mocks.getTopics.mockResolvedValue(
      ["a", "b", "c", "d"].map((id) => topic({ id, name: `Topic ${id}` })),
    );
    show("Topic");
    await settle();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("hides once a topic is picked", async () => {
    const found = topic({});
    mocks.getTopics.mockResolvedValue([found]);
    const again = show("Launch plan");
    await settle();
    expect(screen.getByRole("list")).toBeTruthy();
    again("Launch plan", found);
    expect(screen.queryByRole("list")).toBeNull();
  });
});
