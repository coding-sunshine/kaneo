import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import "@/lib/i18n";
import { DEFAULT_CODING_TOOLS } from "@/lib/coding-tools";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import queryClient from "@/query-client";
import { useCreateIssueStore } from "@/store/create-issue";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { PullRequestMenu } from "./pull-request-menu";

const mocks = vi.hoisted(() => ({
  toggleFavorite: vi.fn(),
  isFavorite: false,
  setLabels: vi.fn(),
  setOwner: vi.fn(),
  requestReviewers: vi.fn(),
  link: vi.fn(),
  draft: vi.fn(),
  merge: vi.fn(),
  close: vi.fn(),
  markReady: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
  getChecks: vi.fn(),
  getConversation: vi.fn(),
}));

vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => {
  const mutation = (mutate: unknown) => () => ({ mutate, isPending: false });
  return {
    useRepoLabels: () => ({
      data: [
        { name: "bug", color: "d73a4a" },
        { name: "docs", color: "0075ca" },
      ],
    }),
    useSetPullRequestLabels: mutation(mocks.setLabels),
    useSetPullRequestOwner: mutation(mocks.setOwner),
    useReviewerCandidates: () => ({
      data: [
        { login: "ada", avatarUrl: "" },
        { login: "grace", avatarUrl: "" },
      ],
      isLoading: false,
    }),
    useRequestReviewers: mutation(mocks.requestReviewers),
    useLinkPullRequestIssue: mutation(mocks.link),
    useConvertToDraft: mutation(mocks.draft),
    useMergePullRequest: mutation(mocks.merge),
    useClosePullRequest: mutation(mocks.close),
    useMarkPullRequestReady: mutation(mocks.markReady),
  };
});
vi.mock("@/fetchers/github-reviews/github-reviews", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPullRequestChecks: mocks.getChecks,
  getPullRequestConversation: mocks.getConversation,
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [
          { userId: "u1", user: { name: "Ada Lovelace", image: null } },
          { userId: "u2", user: { name: "Bo Peep", image: null } },
        ],
      },
    }),
  }),
);
vi.mock("@/hooks/queries/favorite/use-favorites", () => ({
  useFavorite: () => ({
    isFavorite: mocks.isFavorite,
    toggle: mocks.toggleFavorite,
  }),
}));
vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: () => ({
    data: {
      results: [
        { id: "t1", type: "task", title: "Fix login", archivedAt: null },
      ],
    },
    isFetching: false,
  }),
}));

const pullRef = { owner: "acme", repo: "web", number: "7" };
/** Linear's "Copy as prompt" layout for `basePull`, which has a branch and no linked issue. */
const PROMPT =
  /^Checkout branch: `feat`\n\n.+ review: \[acme\/web#7\]\(.+\/reviews\/acme\/web\/7\)\nPull request: \[acme\/web#7\]\(https:\/\/github\.com\/acme\/web\/pull\/7\)$/;
const basePull = {
  owner: "acme",
  repo: "web",
  number: 7,
  title: "Add thing",
  url: "https://github.com/acme/web/pull/7",
  author: { login: "ada", avatarUrl: "" },
  reviewOwner: null,
  originalAuthorUserId: null,
  status: "open" as "open" | "draft" | "merged" | "closed",
  body: "Body text",
  mergeable: true as boolean | null,
  labels: [{ name: "bug", color: "d73a4a" }],
  headRef: "feat",
  baseRef: "main",
  updatedAt: "2026-01-01T00:00:00Z",
  comments: 2,
  requestedReviewers: [] as { login: string; avatarUrl: string }[],
  issue: null,
};

const renderMenu = (pull: Record<string, unknown> = {}) => {
  render(
    <ShortcutTestWrapper>
      <PullRequestMenu
        pullRef={pullRef}
        pull={{ ...basePull, ...pull } as never}
        workspaceId="w1"
      />
    </ShortcutTestWrapper>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Pull request actions" }));
};
const open = async (name: string) =>
  fireEvent.click(await screen.findByText(name));

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m === "function" && "mockClear" in m) m.mockClear();
  });
  mocks.isFavorite = false;
  queryClient.clear();
  mocks.getChecks.mockResolvedValue({ checks: [] });
  mocks.getConversation.mockResolvedValue([]);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
  useReviewsSnoozeStore.setState({ entries: {} });
  useUserPreferencesStore.setState({ codingTools: DEFAULT_CODING_TOOLS });
});
afterEach(cleanup);

describe("PullRequestMenu", () => {
  it("lists Linear's items in order", async () => {
    renderMenu();
    await screen.findByText("Open on GitHub");
    const items = screen
      .getAllByRole("menuitem")
      .map((el) => el.textContent?.trim());
    expect(items).toEqual([
      "Open on GitHub",
      // The second text is the W then O shortcut hint.
      "Work on pull requestWthenO",
      "Favorite",
      "Snooze",
      "Copy",
      "Link issue",
      "Create new issue",
      "Owner",
      "Labels",
      "Select reviewers",
      "Convert to draft",
      "Squash & merge",
      "Close pull request",
    ]);
  });

  it("opens the Work on pull request submenu with W then O", async () => {
    renderMenu();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.keyDown(document.body, { key: "w" });
    fireEvent.keyDown(document.body, { key: "o" });
    expect(await screen.findByText("Copy as prompt")).toBeVisible();
  });

  describe("Work on pull request coding tools", () => {
    it("lists Open in Cursor for an enabled built-in tool", async () => {
      useUserPreferencesStore.setState({
        codingTools: [
          {
            id: "cursor",
            name: "Cursor",
            urlTemplate:
              "cursor://vscode.git/clone?url=https://github.com/{owner}/{repo}.git",
            enabled: true,
            builtin: true,
          },
          {
            id: "vscode",
            name: "VS Code",
            urlTemplate:
              "vscode://vscode.git/clone?url=https://github.com/{owner}/{repo}.git",
            enabled: false,
            builtin: true,
          },
        ],
      });
      renderMenu();
      await open("Work on pull request");
      const cursor = await screen.findByRole("menuitem", {
        name: "Open in Cursor",
      });
      expect(cursor).toHaveAttribute(
        "href",
        "cursor://vscode.git/clone?url=https://github.com/acme/web.git",
      );
      expect(
        screen.queryByRole("menuitem", { name: "Open in VS Code" }),
      ).toBeNull();
    });

    it("lists Open in VS Code and custom configured tools with resolved pull request links", async () => {
      useUserPreferencesStore.setState({
        codingTools: [
          {
            id: "vscode",
            name: "VS Code",
            urlTemplate:
              "vscode://vscode.git/clone?url=https://github.com/{owner}/{repo}.git",
            enabled: true,
            builtin: true,
          },
          {
            id: "custom-ide",
            name: "Cloud IDE",
            urlTemplate:
              "https://ide.example.com/{owner}/{repo}/pull/{number}?branch={branch}",
            enabled: true,
          },
          {
            id: "bad-tool",
            name: "Unsafe",
            urlTemplate: "javascript:alert(1)",
            enabled: true,
          },
        ],
      });
      renderMenu();
      await open("Work on pull request");
      const vscode = await screen.findByRole("menuitem", {
        name: "Open in VS Code",
      });
      expect(vscode).toHaveAttribute(
        "href",
        "vscode://vscode.git/clone?url=https://github.com/acme/web.git",
      );
      const custom = screen.getByRole("menuitem", {
        name: "Open in Cloud IDE",
      });
      expect(custom).toHaveAttribute(
        "href",
        "https://ide.example.com/acme/web/pull/7?branch=feat",
      );
      expect(
        screen.queryByRole("menuitem", { name: "Open in Unsafe" }),
      ).toBeNull();
    });

    it("includes Configure coding tools… pointing to its settings section", async () => {
      renderMenu();
      await open("Work on pull request");
      const configure = await screen.findByRole("menuitem", {
        name: "Configure coding tools…",
      });
      expect(configure).toHaveAttribute(
        "href",
        "/dashboard/settings/account/preferences#coding-tools",
      );
    });
  });

  it("copies the prompt with Cmd+Alt+P, without opening the menu", async () => {
    renderMenu();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.keyDown(document.body, {
      key: "p",
      code: "KeyP",
      ctrlKey: true, // "mod" is Ctrl off macOS, which is what jsdom reports
      altKey: true,
    });
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        expect.stringMatching(PROMPT),
      ),
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("still copies the prompt when one optional fetch fails", async () => {
    mocks.getChecks.mockRejectedValue(new Error("Failed to fetch"));
    mocks.getConversation.mockResolvedValue([
      {
        kind: "review_comment",
        resolved: false,
        path: "a.ts",
        line: 3,
        body: "fix this",
        author: { login: "bo" },
      },
    ]);
    renderMenu();
    await open("Work on pull request");
    await open("Copy as prompt");
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        expect.stringContaining("- a.ts:3 @bo fix this"),
      ),
    );
    expect(mocks.writeText.mock.lastCall?.[0]).not.toContain("Failing checks");
  });

  it("adds failing checks and unresolved comments to the prompt", async () => {
    mocks.getChecks.mockResolvedValue({
      checks: [
        { name: "CI / Build", state: "failure", url: "http://ci/1" },
        { name: "CI / Lint", state: "success", url: "" },
      ],
    });
    mocks.getConversation.mockResolvedValue([
      {
        kind: "review_comment",
        resolved: false,
        path: "a.ts",
        line: 3,
        body: "fix this",
        author: { login: "bo" },
      },
      {
        kind: "review_comment",
        resolved: true,
        path: "b.ts",
        line: 1,
        body: "done",
        author: { login: "bo" },
      },
    ]);
    renderMenu();
    await open("Work on pull request");
    await open("Copy as prompt");
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        expect.stringContaining("- [CI / Build](http://ci/1)"),
      ),
    );
    const text = mocks.writeText.mock.lastCall?.[0] as string;
    expect(text).toContain("- a.ts:3 @bo fix this");
    expect(text).not.toContain("CI / Lint");
    expect(text).not.toContain("b.ts");
  });

  it("toggles the favorite", async () => {
    renderMenu();
    await open("Favorite");
    expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("shows Unfavorite for a favorited pull request", async () => {
    mocks.isFavorite = true;
    renderMenu();
    expect(await screen.findByText("Unfavorite")).toBeVisible();
  });

  it("copies the prompt, with the linked issue, from Work on pull request", async () => {
    renderMenu({
      issue: {
        workspaceId: "w2",
        taskId: "t1",
        title: "Fix login",
        team: { id: "p1" },
      },
    });
    await open("Work on pull request");
    await open("Copy as prompt");
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        expect.stringMatching(
          /\/pull\/7\)\n\nConnected issue:\n- \[Fix login\]\(.*\/workspace\/w2\/project\/p1\/task\/t1\)$/,
        ),
      ),
    );
  });

  it("copies every form from the Copy submenu", async () => {
    renderMenu();
    const copy = async (path: string[], expected: string | RegExp) => {
      for (const name of path) await open(name);
      await waitFor(() =>
        expect(mocks.writeText).toHaveBeenLastCalledWith(
          expected instanceof RegExp
            ? expect.stringMatching(expected)
            : expected,
        ),
      );
    };
    await copy(["Copy", "Copy GitHub URL"], basePull.url);
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    await copy(["Copy", "Copy branch name"], "feat");
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    await copy(["Copy", "Copy review URL"], /\/reviews\/acme\/web\/7$/);
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    await copy(["Copy", "Copy as prompt"], PROMPT);
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    await copy(["Copy", "Copy pull request number...", "Number only"], "#7");
    fireEvent.click(
      screen.getByRole("button", { name: "Pull request actions" }),
    );
    await copy(
      ["Copy", "Copy pull request number...", "Number with repo name"],
      "acme/web#7",
    );
  });

  it("copies the title as a link, falling back to text without rich clipboard", async () => {
    renderMenu();
    await open("Copy");
    await open("Copy title as link");
    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenLastCalledWith(
        `[Add thing](${basePull.url})`,
      ),
    );
  });

  it("snoozes until a preset, then offers Change snooze and Unsnooze", async () => {
    renderMenu();
    await open("Snooze");
    await open("Until new comment");
    expect(
      useReviewsSnoozeStore.getState().entries["acme/web#7"],
    ).toMatchObject({ mode: "newComment", comments: 2 });
    cleanup();
    renderMenu();
    expect(await screen.findByText("Change snooze")).toBeVisible();
    await open("Unsnooze");
    expect(useReviewsSnoozeStore.getState().entries).toEqual({});
  });

  it("snoozes to a typed time", async () => {
    renderMenu();
    await open("Snooze");
    const input = await screen.findByPlaceholderText(
      "Try: 4 pm, 2 days, in 5 weeks...",
    );
    fireEvent.change(input, { target: { value: "2 days" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const entry = useReviewsSnoozeStore.getState().entries["acme/web#7"];
    expect(entry.until).toBeDefined();
  });

  it("sets labels on GitHub when one is toggled", async () => {
    renderMenu();
    await open("Labels");
    expect(
      await screen.findByRole("menuitemcheckbox", { name: "bug" }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "docs" }));
    expect(mocks.setLabels.mock.calls[0][0].sort()).toEqual(["bug", "docs"]);
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "bug" }));
    expect(mocks.setLabels.mock.calls[1][0]).toEqual([]);
  });

  it("requests a review from the picked reviewer, skipping the author", async () => {
    renderMenu();
    await open("Select reviewers");
    expect(screen.queryByRole("button", { name: "ada" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /grace/ }));
    expect(mocks.requestReviewers).toHaveBeenCalledWith(
      ["grace"],
      expect.anything(),
    );
  });

  it("opens the create-issue modal seeded from the pull request", async () => {
    renderMenu();
    await open("Create new issue");
    expect(useCreateIssueStore.getState().open).toBe(true);
    expect(useCreateIssueStore.getState().draft).toMatchObject({
      title: "Add thing",
      pullRequest: { url: basePull.url, status: "open" },
    });
  });

  it("links a searched issue from the dialog", async () => {
    renderMenu();
    await open("Link issue");
    fireEvent.click(await screen.findByRole("button", { name: "Fix login" }));
    expect(mocks.link).toHaveBeenCalledWith(
      { taskId: "t1", url: basePull.url, status: "open" },
      expect.anything(),
    );
  });

  it("hides Link issue when an issue is already linked", async () => {
    renderMenu({ issue: { taskId: "t1" } });
    await screen.findByText("Labels");
    expect(screen.queryByText("Link issue")).toBeNull();
  });

  it.each([
    ["Convert to draft", () => mocks.draft],
    ["Squash & merge", () => mocks.merge],
    ["Close pull request", () => mocks.close],
  ])("%s asks first, then calls GitHub once", async (label, spy) => {
    renderMenu();
    await open(label);
    expect(spy()).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === label,
      ) as HTMLElement,
    );
    expect(spy()).toHaveBeenCalledTimes(1);
  });

  it("squashes with the squash method", async () => {
    renderMenu();
    await open("Squash & merge");
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === "Squash & merge",
      ) as HTMLElement,
    );
    expect(mocks.merge.mock.calls[0][0]).toBe("squash");
  });

  it("disables Squash & merge until GitHub says it is mergeable", async () => {
    renderMenu({ mergeable: null });
    const item = await screen.findByText("Squash & merge");
    expect(item.closest("[role=menuitem]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows Mark ready instead of Convert to draft on a draft", async () => {
    renderMenu({ status: "draft" });
    await open("Mark ready for review");
    expect(mocks.markReady).toHaveBeenCalledTimes(1);
  });

  it("offers no GitHub writes on a merged pull request", async () => {
    renderMenu({ status: "merged" });
    await screen.findByText("Copy");
    expect(screen.queryByText("Close pull request")).toBeNull();
    expect(screen.queryByText("Labels")).toBeNull();
  });
});
