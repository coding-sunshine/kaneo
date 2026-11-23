import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import "@/lib/i18n";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { PullRequestPage } from "./pull-request-page";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  merge: vi.fn(),
  pull: {} as Record<string, unknown>,
  requestReviewers: vi.fn(),
  markReady: vi.fn(),
  link: vi.fn(),
  unlink: vi.fn(),
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
  requestedReviewers: [] as { login: string; avatarUrl: string }[],
  issue: null as null | Record<string, unknown>,
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
      {
        filename: "lib/c.ts",
        status: "added",
        additions: 1,
        deletions: 0,
        patch: "@@ -0,0 +1 @@\n+c",
      },
    ],
  }),
  useSubmitReview: () => ({ mutate: mocks.submit, isPending: false }),
  useMergePullRequest: () => ({ mutate: mocks.merge, isPending: false }),
  useAddPullRequestComment: () => ({ mutate: vi.fn(), isPending: false }),
  useReviewerCandidates: () => ({
    data: [
      { login: "ada", avatarUrl: "" },
      { login: "grace", avatarUrl: "" },
      { login: "linus", avatarUrl: "" },
    ],
    isLoading: false,
  }),
  useRequestReviewers: () => ({
    mutate: mocks.requestReviewers,
    isPending: false,
  }),
  useMarkPullRequestReady: () => ({
    mutate: mocks.markReady,
    isPending: false,
  }),
  useLinkPullRequestIssue: () => ({ mutate: mocks.link, isPending: false }),
  useUnlinkPullRequestIssue: () => ({ mutate: mocks.unlink, isPending: false }),
}));
vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: () => ({
    data: {
      results: [
        { id: "t1", type: "task", title: "Fix login", archivedAt: null },
        { id: "t2", type: "task", title: "Old task", archivedAt: "2026-01-01" },
      ],
    },
    isFetching: false,
  }),
}));
vi.mock("@/components/reviews/markdown", () => ({
  Markdown: ({ value }: { value: string }) => <p>{value}</p>,
}));
// The real shell pulls in the whole sidebar; only its header row is used here.
vi.mock("@/components/common/layout", () => ({
  default: {
    Header: ({ children }: { children: React.ReactNode }) => (
      <header>{children}</header>
    ),
  },
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
  mocks.requestReviewers.mockClear();
  mocks.markReady.mockClear();
  mocks.link.mockClear();
  mocks.unlink.mockClear();
  useUserPreferencesStore.setState({ reviewsExpanded: false });
});
afterEach(cleanup);

describe("PullRequestPage", () => {
  it("lists status, labels and a checks summary, then the conversation", async () => {
    renderPage();
    expect(screen.getByText("Status").nextElementSibling).toHaveTextContent(
      "Open",
    );
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("ship it")).toBeInTheDocument();
    // Nobody is requested yet; an open pull request still offers Add reviewers.
    expect(screen.getByText("Reviewers").nextElementSibling).toHaveTextContent(
      "Add reviewers",
    );
    fireEvent.click(screen.getByRole("button", { name: "1 failed, 1 passed" }));
    expect((await screen.findByText("ci")).closest("li")).toHaveAttribute(
      "data-state",
      "failure",
    );
    expect(screen.getByText("lint").closest("li")).toHaveAttribute(
      "data-state",
      "success",
    );
  });

  it("shows requested reviewers", () => {
    mocks.pull = {
      ...basePull,
      requestedReviewers: [{ login: "grace", avatarUrl: "" }],
    };
    renderPage();
    expect(screen.getByText("Reviewers").nextElementSibling).toHaveTextContent(
      "grace",
    );
  });

  it("expands the pull request over the list and back", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(useUserPreferencesStore.getState().reviewsExpanded).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(useUserPreferencesStore.getState().reviewsExpanded).toBe(false);
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

  it("folds a reviewed file and keeps it folded across tabs", () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    expect(container.querySelectorAll("[data-layout]")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Reviewed" })[0]);
    expect(container.querySelectorAll("[data-layout]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    expect(container.querySelectorAll("[data-layout]")).toHaveLength(1);
    expect(
      screen.getAllByRole("checkbox", { name: "Reviewed" })[0],
    ).toBeChecked();
  });

  it("filters the file list and the diffs by name", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Filter files..." }),
      {
        target: { value: "LIB/" },
      },
    );
    expect(screen.getAllByText("lib/c.ts")).toHaveLength(1);
    expect(screen.queryByText("a.ts")).toBeNull();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Filter files..." }),
      {
        target: { value: "zzz" },
      },
    );
    expect(screen.getByText("No files match this filter.")).toBeInTheDocument();
  });

  it("switches the Files diff between unified and split with Ctrl+B", () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    expect(container.querySelector("[data-layout=unified]")).not.toBeNull();
    fireEvent.keyDown(document.body, { key: "b", ctrlKey: true });
    expect(container.querySelector("[data-layout=split]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unified" }));
    expect(container.querySelector("[data-layout=unified]")).not.toBeNull();
  });

  it("leaves the Reviewers row out of a merged pull request without reviewers", () => {
    mocks.pull = { ...basePull, status: "merged", mergeable: false };
    renderPage();
    expect(screen.queryByText("Reviewers")).toBeNull();
  });

  it("requests the chosen person and hides the author and people already asked", async () => {
    mocks.pull = {
      ...basePull,
      requestedReviewers: [{ login: "grace", avatarUrl: "" }],
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add reviewers" }));
    expect(await screen.findByRole("button", { name: /linus/ })).toBeVisible();
    // ada wrote the pull request; grace is already requested.
    expect(screen.queryByRole("button", { name: /ada/ })).toBeNull();
    expect(
      screen
        .getAllByText("grace")
        .every((node) => node.closest("button") === null),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /linus/ }));
    expect(mocks.requestReviewers.mock.calls[0][0]).toEqual(["linus"]);
  });

  it("offers Ready for review on a draft instead of Merge", () => {
    mocks.pull = { ...basePull, status: "draft", mergeable: false };
    renderPage();
    expect(screen.queryByRole("button", { name: "Merge" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ready for review" }));
    expect(mocks.markReady).toHaveBeenCalledTimes(1);
  });

  it("shows no Ready for review on an open pull request", async () => {
    renderPage();
    expect(
      screen.queryByRole("button", { name: "Ready for review" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    expect(await screen.findByText("Copy branch name")).toBeVisible();
    expect(screen.queryByText("Mark ready for review")).toBeNull();
  });

  it("marks a draft ready from the actions menu", async () => {
    mocks.pull = { ...basePull, status: "draft", mergeable: false };
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    fireEvent.click(await screen.findByText("Mark ready for review"));
    expect(mocks.markReady).toHaveBeenCalledTimes(1);
  });

  it("copies the GitHub URL and the branch name from the actions menu", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    fireEvent.click(await screen.findByText("Copy GitHub URL"));
    expect(writeText).toHaveBeenLastCalledWith(basePull.url);
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    fireEvent.click(await screen.findByText("Copy branch name"));
    expect(writeText).toHaveBeenLastCalledWith("feat");
  });

  it("copies this page's URL from the header link control", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Copy review URL" }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("shows No issue, then links a searched task with the pull request status", async () => {
    renderPage();
    expect(screen.getByText("No issue")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Link issue to pull request" }),
    );
    fireEvent.change(await screen.findByLabelText("Search issues..."), {
      target: { value: "log" },
    });
    // Archived tasks are not offered.
    expect(screen.queryByText("Old task")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fix login" }));
    expect(mocks.link.mock.calls[0][0]).toEqual({
      taskId: "t1",
      url: basePull.url,
      status: "open",
    });
  });

  it("shows the linked issue in the breadcrumb and Issues row and unlinks a manual link", () => {
    mocks.pull = {
      ...basePull,
      issue: {
        taskId: "t1",
        workspaceId: "w1",
        linkId: "l1",
        manual: true,
        title: "Fix login",
        team: { id: "p1", name: "Eng" },
      },
    };
    renderPage();
    expect(screen.queryByText("No issue")).toBeNull();
    expect(screen.getAllByText("Fix login")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Unlink issue" }));
    expect(mocks.unlink.mock.calls[0][0]).toEqual({
      taskId: "t1",
      id: "l1",
    });
  });

  it("does not offer to unlink an integration-managed link", () => {
    mocks.pull = {
      ...basePull,
      issue: {
        taskId: "t1",
        workspaceId: "w1",
        linkId: "l1",
        manual: false,
        title: "Fix login",
        team: { id: "p1", name: "Eng" },
      },
    };
    renderPage();
    expect(screen.queryByRole("button", { name: "Unlink issue" })).toBeNull();
  });
});
