import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskTopics } from "./task-topics";

const mocks = vi.hoisted(() => ({
  getTaskTopics: vi.fn(),
  getTopics: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/fetchers/topic/topics", () => ({
  getTaskTopics: mocks.getTaskTopics,
  getTopics: mocks.getTopics,
  linkTaskTopic: mocks.link,
  unlinkTaskTopic: mocks.unlink,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
  }: {
    params: Record<string, string>;
    children: ReactNode;
  }) => <a href={`/${params.documentId ?? params.topicId}`}>{children}</a>,
}));

const topic = (id: string, name: string, over = {}) => ({
  id,
  name,
  scope: "workspace",
  parentName: null,
  currentDocumentId: null,
  currentDocumentTitle: null,
  ...over,
});
const launch = topic("t1", "Launch plan", {
  currentDocumentId: "d1",
  currentDocumentTitle: "Launch plan v2",
});
const venue = topic("t2", "Venue", { scope: "team", parentName: "Events" });

const show = () => {
  mocks.getTaskTopics.mockResolvedValue([launch]);
  mocks.getTopics.mockResolvedValue([launch, venue]);
  mocks.link.mockResolvedValue({ tasks: [] });
  mocks.unlink.mockResolvedValue({ tasks: [] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TaskTopics workspaceId="ws" taskId="task-1" />
    </QueryClientProvider>,
  );
};

describe("TaskTopics", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("links to the topic's current document", async () => {
    show();
    const link = await screen.findByRole("link", { name: "Launch plan v2" });
    expect(link.getAttribute("href")).toBe("/d1");
  });

  it("says who can open each topic on the issue", async () => {
    mocks.getTaskTopics.mockResolvedValue([launch, venue]);
    mocks.getTopics.mockResolvedValue([launch, venue]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TaskTopics workspaceId="ws" taskId="task-1" />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText("navigation:documents.accessLabel.workspace"),
    ).toBeTruthy();
    expect(screen.getByText("Events")).toBeTruthy();
    expect(
      screen.getByText("navigation:documents.accessLabel.team:"),
    ).toBeTruthy();
  });

  it("removes the topic from the issue", async () => {
    show();
    fireEvent.click(
      await screen.findByRole("button", {
        name: 'navigation:documents.taskTopic.remove {"name":"Launch plan"}',
      }),
    );
    await vi.waitFor(() =>
      expect(mocks.unlink.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "t1",
        taskId: "task-1",
      }),
    );
  });

  it("offers only the topics not on the issue", async () => {
    show();
    await screen.findByRole("link", { name: "Launch plan v2" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.taskTopic.add",
      }),
    );
    expect(await screen.findByRole("menuitem", { name: "Venue" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Launch plan" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Venue" }));
    await vi.waitFor(() =>
      expect(mocks.link.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "t2",
        taskId: "task-1",
      }),
    );
  });
});
