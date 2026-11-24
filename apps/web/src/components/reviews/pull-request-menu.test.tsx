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
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { useCreateIssueStore } from "@/store/create-issue";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";
import { PullRequestMenu } from "./pull-request-menu";

const mocks = vi.hoisted(() => ({
  toggleFavorite: vi.fn(),
  isFavorite: false,
  setLabels: vi.fn(),
  requestReviewers: vi.fn(),
  link: vi.fn(),
  draft: vi.fn(),
  merge: vi.fn(),
  close: vi.fn(),
  markReady: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
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
const basePull = {
  owner: "acme",
  repo: "web",
  number: 7,
  title: "Add thing",
  url: "https://github.com/acme/web/pull/7",
  author: { login: "ada", avatarUrl: "" },
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
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
  useReviewsSnoozeStore.setState({ entries: {} });
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
      "Favorite",
      "Snooze",
      "Copy",
      "Link issue",
      "Create new issue",
      "Labels",
      "Select reviewers",
      "Convert to draft",
      "Squash & merge",
      "Close pull request",
    ]);
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
    await copy(["Copy", "Copy as prompt"], /Add thing[\s\S]*Body text/);
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
