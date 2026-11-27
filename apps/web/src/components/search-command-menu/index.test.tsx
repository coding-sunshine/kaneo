import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import SearchCommandMenu from "./index";

const searchResults = {
  results: [
    {
      id: "task-12",
      type: "task",
      title: "Collect the weekly report list",
      projectId: "project-1",
      projectSlug: "FF",
      taskNumber: 12,
    },
    {
      id: "task-23",
      type: "task",
      title: "Rewrite the workflow note",
      description: "Mentions FF-12 in passing.",
      projectId: "project-2",
      projectSlug: "PER",
      taskNumber: 23,
    },
    {
      id: "activity-9",
      type: "comment",
      title: "Comment on Ship it",
      content: "rollback tonight",
      projectId: "project-1",
      taskId: "task-99",
    },
    {
      id: "doc-1",
      type: "document",
      title: "Onboarding handbook",
      projectName: "Platform",
      scope: "team",
      parentName: "Platform",
    },
    {
      id: "doc-2",
      type: "document",
      title: "Release handbook",
      status: "current",
      topicName: "Release process",
    },
    {
      id: "doc-3",
      type: "document",
      title: "Release handbook ideas",
      status: "draft",
      scope: "private",
      parentName: null,
    },
    {
      id: "doc-4",
      type: "document",
      title: "Hiring handbook",
      scope: "team",
      parentName: null,
    },
    {
      id: "message-1",
      type: "message",
      title: "launch-room",
      content: "the rollout starts at noon",
      channelId: "channel-1",
      isDirect: false,
    },
    {
      id: "message-2",
      type: "message",
      title: "",
      content: "can you check the rollout",
      channelId: "channel-2",
      isDirect: true,
    },
  ],
};

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: () => ({ data: searchResults }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  getModifierKeyText: () => "Ctrl",
  useRegisterShortcuts: vi.fn(),
}));

describe("SearchCommandMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a task found by its key even when its text does not contain the key", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);

    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "FF-12" } },
    );

    expect(
      await screen.findByText("Collect the weekly report list"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rewrite the workflow note")).toBeInTheDocument();
  });

  it("shows a document with its team and opens it", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);
    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "handbook" } },
    );

    expect(
      await screen.findByText("navigation:search.groups.document"),
    ).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Onboarding handbook"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/document/$documentId",
      params: { workspaceId: "workspace-1", documentId: "doc-1" },
    });
  });

  it("says who can open a document, naming only a team the reader can enter", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);
    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "handbook" } },
    );

    const named = await screen.findByRole("option", {
      name: /Onboarding handbook/,
    });
    expect(named).toHaveTextContent(
      "navigation:documents.accessLabel.team: Platform",
    );
    expect(
      screen.getByRole("option", { name: /Release handbook ideas/ }),
    ).toHaveTextContent("navigation:documents.accessLabel.private");
    const hidden = screen.getByRole("option", { name: /Hiring handbook/ });
    expect(hidden).toHaveTextContent("navigation:documents.accessLabel.team");
    expect(hidden).not.toHaveTextContent("Platform");
  });

  it("marks a current document apart from a draft and names its topic", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);
    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "release" } },
    );

    const current = await screen.findByRole("option", {
      name: /Release handbook$/,
    });
    const draft = screen.getByRole("option", {
      name: /Release handbook ideas/,
    });
    expect(current).toHaveTextContent("navigation:documents.status.current");
    expect(current).toHaveTextContent("Release process");
    expect(draft).toHaveTextContent("navigation:documents.status.draft");
    expect(draft).not.toHaveTextContent("navigation:documents.status.current");
  });

  it("opens the task a comment belongs to", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);
    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "rollback" } },
    );
    fireEvent.click(await screen.findByText("Comment on Ship it"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: "workspace-1",
        projectId: "project-1",
        taskId: "task-99",
      },
    });
  });

  it("names a message by its channel and opens the channel at that message", async () => {
    render(<SearchCommandMenu open setOpen={vi.fn()} />);
    fireEvent.change(
      screen.getByPlaceholderText("navigation:search.inputPlaceholder"),
      { target: { value: "rollout" } },
    );
    expect(
      await screen.findByText("navigation:search.groups.message"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("workspace:search.directMessage"),
    ).toBeInTheDocument();
    expect(screen.getByText("can you check the rollout")).toBeInTheDocument();

    fireEvent.click(screen.getByText("#launch-room"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/channels/$channelId",
      params: { workspaceId: "workspace-1", channelId: "channel-1" },
      search: { messageId: "message-1" },
    });
  });
});
