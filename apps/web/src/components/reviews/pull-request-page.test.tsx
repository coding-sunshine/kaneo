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
import { DEFAULT_DIFF_OPTIONS } from "@/components/reviews/diff-options-menu";
import { useReviewsDiffOptionsStore } from "@/store/reviews-diff-options";
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
  commits: [] as { sha: string; title: string; date: string; parent: string }[],
  compare: vi.fn(),
  content: "" as string | null,
}));

const basePull = {
  owner: "acme",
  repo: "web",
  number: 7,
  title: "Add thing",
  url: "https://github.com/acme/web/pull/7",
  author: { login: "synthetic-author", avatarUrl: "" },
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
  usePullRequestCommits: () => ({ data: mocks.commits }),
  useComparedFiles: (_ref: unknown, range: unknown) => {
    mocks.compare(range);
    return {
      data: [
        {
          filename: "scoped.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          patch: "@@ -1 +1 @@\n-x\n+y",
        },
      ],
    };
  },
  useFileContent: (
    _ref: unknown,
    _path: string,
    _sha: unknown,
    enabled: boolean,
  ) => ({
    data:
      enabled && mocks.content !== null
        ? { content: mocks.content }
        : undefined,
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
      { login: "synthetic-author", avatarUrl: "" },
      { login: "synthetic-second", avatarUrl: "" },
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
  useConvertToDraft: () => ({ mutate: vi.fn(), isPending: false }),
  useClosePullRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useRepoLabels: () => ({ data: [] }),
  useSetPullRequestLabels: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/queries/favorite/use-favorites", () => ({
  useFavorite: () => ({ isFavorite: false, toggle: vi.fn() }),
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
  useRouter: () => null,
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
  mocks.commits = [];
  mocks.content = null;
  mocks.compare.mockClear();
  mocks.submit.mockClear();
  mocks.merge.mockClear();
  mocks.requestReviewers.mockClear();
  mocks.markReady.mockClear();
  mocks.link.mockClear();
  mocks.unlink.mockClear();
  useUserPreferencesStore.setState({ reviewsExpanded: false });
  useReviewsDiffOptionsStore.setState({ options: DEFAULT_DIFF_OPTIONS });
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

  it("names owner/repo #number in the header as a link to GitHub, with author and head → base", () => {
    renderPage();
    const link = screen.getByRole("link", { name: "acme/web #7" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/web/pull/7");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("synthetic-author")).toBeInTheDocument();
    expect(screen.getByText("feat → main")).toBeInTheDocument();
  });

  it("shows requested reviewers", () => {
    mocks.pull = {
      ...basePull,
      requestedReviewers: [{ login: "synthetic-second", avatarUrl: "" }],
    };
    renderPage();
    expect(screen.getByText("Reviewers").nextElementSibling).toHaveTextContent(
      "synthetic-second",
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
    expect(screen.getAllByTitle("lib/c.ts").length).toBeGreaterThan(0);
    expect(screen.queryAllByTitle("a.ts")).toHaveLength(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Diff options" }));
    fireEvent.click(screen.getByRole("button", { name: "Unified" }));
    expect(container.querySelector("[data-layout=unified]")).not.toBeNull();
  });

  it("keeps the ticked files for this head commit after the page remounts", () => {
    localStorage.clear();
    const first = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Reviewed" })[0]);
    first.unmount();
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    expect(
      screen.getAllByRole("checkbox", { name: "Reviewed" })[0],
    ).toBeChecked();
    cleanup();
    mocks.pull = { ...basePull, headSha: "def" };
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    expect(
      screen.getAllByRole("checkbox", { name: "Reviewed" })[0],
    ).not.toBeChecked();
    localStorage.clear();
  });

  it("wraps lines and hides reviewed files from the Diff options menu", () => {
    localStorage.clear();
    const { container } = renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Reviewed" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Diff options" }));
    fireEvent.click(screen.getByRole("switch", { name: "Wrap lines" }));
    expect(container.querySelector("[data-layout]")?.className).not.toContain(
      "overflow-x-auto",
    );
    expect(container.querySelectorAll("section")).toHaveLength(2);
    fireEvent.click(screen.getByRole("switch", { name: "Hide reviewed" }));
    expect(container.querySelectorAll("section")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("switch", { name: "Show changed lines per file" }),
    );
    expect(screen.queryByText("+1")).toBeNull();
    localStorage.clear();
  });

  it("lists files as a tree and groups them by file type from the Diff options menu", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Diff options" }));
    fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(screen.getByRole("button", { name: "lib" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "File type" }));
    expect(
      screen.getAllByRole("heading", { name: "Implementation" }).length,
    ).toBeGreaterThan(0);
  });

  it("keeps the Diff options across visits", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Diff options" }));
    fireEvent.click(screen.getByRole("button", { name: "Solarized" }));
    fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    expect(
      JSON.parse(localStorage.getItem("reviews-diff-options") ?? "{}").state
        .options,
    ).toMatchObject({ codeTheme: "solarized", fileList: "tree" });
  });

  it("opens an unchanged-lines separator and shows a trailing one", () => {
    mocks.content = "1\n2\n3\n4\n5";
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    // a.ts changes line 1 of 5: only a trailing separator.
    const before = screen.getAllByRole("button", { name: "4 unchanged lines" });
    fireEvent.click(before[0]);
    expect(
      screen.getAllByRole("button", { name: "4 unchanged lines" }),
    ).toHaveLength(before.length - 1);
  });

  it("scopes the diff to the commits picked in the Commits list", () => {
    mocks.commits = [
      {
        sha: "a".repeat(40),
        title: "first",
        date: "2026-01-01",
        parent: "p".repeat(40),
      },
      {
        sha: "b".repeat(40),
        title: "second",
        date: "2026-01-02",
        parent: "a".repeat(40),
      },
    ];
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    fireEvent.click(screen.getByRole("tab", { name: /Commits/ }));
    expect(screen.getByText("2 commits")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /second/ }));
    expect(mocks.compare).toHaveBeenLastCalledWith({
      base: "a".repeat(40),
      head: "b".repeat(40),
    });
    expect(screen.getAllByText("scoped.ts").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /All commits/ }));
    expect(screen.queryByText("scoped.ts")).toBeNull();
  });

  it("warns when GitHub cannot return every commit", () => {
    mocks.commits = Array.from({ length: 250 }, (_, i) => ({
      sha: i.toString(16).padStart(40, "0"),
      title: `c${i}`,
      date: "2026-01-01",
      parent: "p".repeat(40),
    }));
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Diff" }));
    expect(
      screen.getByText("This review is too large to show in full"),
    ).toBeInTheDocument();
  });

  it("leaves the Reviewers row out of a merged pull request without reviewers", () => {
    mocks.pull = { ...basePull, status: "merged", mergeable: false };
    renderPage();
    expect(screen.queryByText("Reviewers")).toBeNull();
  });

  it("requests the chosen person and hides the author and people already asked", async () => {
    mocks.pull = {
      ...basePull,
      requestedReviewers: [{ login: "synthetic-second", avatarUrl: "" }],
    };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add reviewers" }));
    expect(await screen.findByRole("button", { name: /linus/ })).toBeVisible();
    // synthetic-author wrote the pull request; synthetic-second is already requested.
    expect(
      screen.queryByRole("button", { name: /synthetic-author/ }),
    ).toBeNull();
    expect(
      screen
        .getAllByText("synthetic-second")
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
    expect(await screen.findByText("Squash & merge")).toBeVisible();
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

  it("copies the GitHub URL and the branch name from the GitHub chip menu", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderPage();
    const chip = () =>
      screen.getByRole("button", { name: /web#7, pull request actions/ });
    fireEvent.click(chip());
    fireEvent.click(await screen.findByText("Copy GitHub URL"));
    expect(writeText).toHaveBeenLastCalledWith(basePull.url);
    fireEvent.click(chip());
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
