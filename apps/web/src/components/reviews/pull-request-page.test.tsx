import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { PullRequestPage } from "./pull-request-page";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  merge: vi.fn(),
  pull: {} as Record<string, unknown>,
}));

const basePull = {
  owner: "acme",
  repo: "web",
  number: 7,
  title: "Add thing",
  url: "https://github.com/acme/web/pull/7",
  author: { login: "ada", avatarUrl: "" },
  status: "open",
  body: "",
  mergeable: true,
  labels: [{ name: "bug", color: "d73a4a" }],
  headSha: "abc",
  headRef: "feat",
  baseRef: "main",
  additions: 2,
  deletions: 1,
  changedFiles: 1,
};

vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => ({
  usePullRequest: () => ({ data: mocks.pull, isLoading: false }),
  usePullRequestChecks: () => ({
    data: {
      state: "failure",
      checks: [
        { name: "ci", state: "failure", url: null },
        { name: "lint", state: "success", url: null },
      ],
    },
  }),
  usePullRequestConversation: () => ({
    data: [
      {
        id: "comment-1",
        kind: "comment",
        author: { login: "bob", avatarUrl: "" },
        body: "ship it",
        reviewState: null,
        path: null,
        line: null,
        side: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
  }),
  usePullRequestFiles: () => ({
    data: [
      {
        filename: "a.ts",
        status: "modified",
        additions: 1,
        deletions: 1,
        patch: "@@ -1 +1 @@\n-a\n+b",
      },
    ],
  }),
  useSubmitReview: () => ({ mutate: mocks.submit, isPending: false }),
  useMergePullRequest: () => ({ mutate: mocks.merge, isPending: false }),
  useAddPullRequestComment: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/reviews/markdown", () => ({
  Markdown: ({ value }: { value: string }) => <p>{value}</p>,
}));
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const renderPage = () =>
  render(
    <ShortcutTestWrapper>
      <PullRequestPage
        pullRef={{ owner: "acme", repo: "web", number: "7" }}
        workspaceId="w1"
      />
    </ShortcutTestWrapper>,
  );

beforeEach(() => {
  mocks.pull = { ...basePull };
  mocks.submit.mockClear();
  mocks.merge.mockClear();
});
afterEach(cleanup);

describe("PullRequestPage", () => {
  it("shows labels, checks and the conversation on Overview", () => {
    renderPage();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("ci").closest("li")).toHaveAttribute(
      "data-state",
      "failure",
    );
    expect(screen.getByText("lint").closest("li")).toHaveAttribute(
      "data-state",
      "success",
    );
    expect(screen.getByText("ship it")).toBeInTheDocument();
  });

  it("disables Merge unless GitHub says the pull request is mergeable", () => {
    mocks.pull = { ...basePull, mergeable: null };
    renderPage();
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    cleanup();
    mocks.pull = { ...basePull };
    renderPage();
    expect(screen.getByRole("button", { name: "Merge" })).toBeEnabled();
  });

  it("hides the actions once the pull request is merged", () => {
    mocks.pull = { ...basePull, status: "merged", mergeable: false };
    renderPage();
    expect(screen.queryByRole("button", { name: "Merge" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Review" })).toBeNull();
  });

  it("submits the chosen review event with its body", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const submitButton = await screen.findByRole("button", {
      name: "Submit review",
    });
    expect(submitButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Leave a review comment"), {
      target: { value: "needs work" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Request changes" }));
    fireEvent.click(submitButton);
    expect(mocks.submit.mock.calls[0][0]).toEqual({
      event: "REQUEST_CHANGES",
      body: "needs work",
    });
  });

  it("switches the Files diff between unified and split with Ctrl+B", () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /Files changed/ }));
    expect(container.querySelector("[data-layout=unified]")).not.toBeNull();
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true });
    expect(container.querySelector("[data-layout=split]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unified" }));
    expect(container.querySelector("[data-layout=unified]")).not.toBeNull();
  });
});
