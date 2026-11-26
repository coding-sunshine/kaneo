import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TopicIssueFacts } from "./topic-issue-facts";

const mocks = vi.hoisted(() => ({
  getTopicTaskStatements: vi.fn(),
  setTaskStatementDismissed: vi.fn(),
  linkTaskTopic: vi.fn(),
  canUpdateTasks: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/topic/task-statements", () => ({
  getTopicTaskStatements: mocks.getTopicTaskStatements,
  setTaskStatementDismissed: mocks.setTaskStatementDismissed,
}));
vi.mock("@/fetchers/topic/topics", () => ({
  linkTaskTopic: mocks.linkTaskTopic,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: mocks.canUpdateTasks }),
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
    <a href={`/${params.projectId}/${params.taskId}`} className={className}>
      {children}
    </a>
  ),
}));

const P = "navigation:documents.issueFacts";

const statement = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  slot: "s1",
  slotName: "Venue",
  value: "Harbour Hall",
  quote: "we booked Harbour Hall",
  task: {
    id: "t1",
    title: "Book the venue",
    number: 12,
    projectId: "p1",
    projectSlug: "grw",
  },
  file: { id: "file1", filename: "plan.pdf" },
  onTopic: false,
  dismissed: false,
  ...over,
});

const show = (statements: ReturnType<typeof statement>[], canEdit = true) => {
  mocks.canUpdateTasks.mockReturnValue(canEdit);
  mocks.getTopicTaskStatements.mockResolvedValue({ statements });
  mocks.setTaskStatementDismissed.mockResolvedValue({});
  mocks.linkTaskTopic.mockResolvedValue({});
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TopicIssueFacts workspaceId="ws" topicId="topic-1" />
    </QueryClientProvider>,
  );
};

describe("TopicIssueFacts", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing without suggestions", async () => {
    show([]);
    await vi.waitFor(() =>
      expect(mocks.getTopicTaskStatements).toHaveBeenCalled(),
    );
    expect(screen.queryByText(`${P}.title`)).toBeNull();
  });

  it("shows the suggestion with its issue and file", async () => {
    show([statement()]);
    expect(await screen.findByText("Venue")).toBeTruthy();
    expect(screen.getByText("Harbour Hall")).toBeTruthy();
    expect(screen.getByText("we booked Harbour Hall")).toBeTruthy();
    expect(screen.getByText("GRW-12")).toBeTruthy();
    expect(screen.getByText("Book the venue")).toBeTruthy();
    expect(screen.getByText(`${P}.inFile`)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /GRW-12/ }).getAttribute("href"),
    ).toBe("/p1/t1");
  });

  it("adds the issue to the topic, unless it is already there", async () => {
    show([statement()]);
    fireEvent.click(await screen.findByText(`${P}.addIssue`));
    await vi.waitFor(() =>
      expect(mocks.linkTaskTopic.mock.calls[0]?.[0]).toEqual({
        workspaceId: "ws",
        id: "topic-1",
        taskId: "t1",
      }),
    );
    cleanup();
    show([statement({ onTopic: true })]);
    expect(await screen.findByText(`${P}.onTopic`)).toBeTruthy();
    expect(screen.queryByText(`${P}.addIssue`)).toBeNull();
  });

  it("dismisses and restores", async () => {
    show([statement(), statement({ id: "f2", dismissed: true })]);
    fireEvent.click(await screen.findByText(`${P}.dismiss`));
    await vi.waitFor(() =>
      expect(mocks.setTaskStatementDismissed).toHaveBeenCalledWith(
        { workspaceId: "ws", id: "topic-1", factId: "f1" },
        true,
      ),
    );
    expect(screen.queryByText(`${P}.restore`)).toBeNull();
    const toggle = screen.getByRole("button", { name: `${P}.showDismissed` });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    fireEvent.click(await screen.findByText(`${P}.restore`));
    await vi.waitFor(() =>
      expect(mocks.setTaskStatementDismissed).toHaveBeenCalledWith(
        { workspaceId: "ws", id: "topic-1", factId: "f2" },
        false,
      ),
    );
  });

  it("hides the buttons from a person who cannot update tasks", async () => {
    show([statement(), statement({ id: "f2", dismissed: true })], false);
    expect(await screen.findByText("Venue")).toBeTruthy();
    expect(screen.queryByText(`${P}.addIssue`)).toBeNull();
    expect(screen.queryByText(`${P}.dismiss`)).toBeNull();
    expect(
      screen.getByRole("button", { name: `${P}.showDismissed` }),
    ).toBeTruthy();
  });
});
