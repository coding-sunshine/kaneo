import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TopicIssues } from "./topic-issues";

const mocks = vi.hoisted(() => ({ getTopicTasks: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/topic/topics", () => ({
  getTopicTasks: mocks.getTopicTasks,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
    className,
  }: {
    params: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={`/${params.taskId}`} className={className}>
      {children}
    </a>
  ),
}));

const issue = (number: number, title: string, closed: boolean) => ({
  id: `task-${number}`,
  topicId: "topic-1",
  title,
  number,
  projectId: "p1",
  projectSlug: "grw",
  status: closed ? "done" : "todo",
  closed,
});

const show = (tasks: ReturnType<typeof issue>[]) => {
  mocks.getTopicTasks.mockResolvedValue({ tasks });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TopicIssues workspaceId="ws" topicId="topic-1" />
    </QueryClientProvider>,
  );
};

describe("TopicIssues", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists keys and titles as links", async () => {
    show([issue(1, "Book the venue", false), issue(2, "Send invites", true)]);
    expect(await screen.findByText("GRW-1")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Book the venue/ })).toBeTruthy();
    expect(
      screen.getAllByText("navigation:documents.taskTopic.closed"),
    ).toHaveLength(1);
    expect(
      screen.queryByText("navigation:documents.taskTopic.allClosed"),
    ).toBeNull();
  });

  it("says so when every issue is closed", async () => {
    show([issue(1, "Book the venue", true)]);
    expect(
      await screen.findByText("navigation:documents.taskTopic.allClosed"),
    ).toBeTruthy();
  });

  it("explains an empty list", async () => {
    show([]);
    expect(
      await screen.findByText("navigation:documents.taskTopic.noIssues"),
    ).toBeTruthy();
    expect(
      screen.queryByText("navigation:documents.taskTopic.allClosed"),
    ).toBeNull();
  });
});
