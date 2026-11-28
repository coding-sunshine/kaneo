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
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";
import { ReviewRowMenu } from "./review-row-menu";

const mocks = vi.hoisted(() => ({
  toggleFavorite: vi.fn(),
  setLabels: vi.fn(),
  setOwner: vi.fn(),
  requestReviewers: vi.fn(),
  onAction: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => ({
  useRepoLabels: () => ({
    data: [
      { name: "bug", color: "d73a4a" },
      { name: "docs", color: "0075ca" },
    ],
  }),
  useSetPullRequestLabels: () => ({
    mutate: mocks.setLabels,
    isPending: false,
  }),
  useSetPullRequestOwner: () => ({
    mutate: mocks.setOwner,
    isPending: false,
  }),
  useReviewerCandidates: () => ({
    data: [
      { login: "synthetic-author", avatarUrl: "" },
      { login: "synthetic-reviewer", avatarUrl: "" },
      { login: "synthetic-second", avatarUrl: "" },
    ],
    isLoading: false,
  }),
  useRequestReviewers: () => ({
    mutate: mocks.requestReviewers,
    isPending: false,
  }),
  usePullRequestChecks: () => ({
    isLoading: false,
    isError: false,
    data: {
      checks: [
        { name: "CI / Test", state: "pending", url: "", durationSeconds: null },
        { name: "CI / Lint", state: "success", url: "", durationSeconds: 65 },
        { name: "CI / Build", state: "failure", url: "", durationSeconds: 9 },
      ],
    },
  }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [
          { userId: "u1", user: { name: "Synthetic Member", image: null } },
          { userId: "u2", user: { name: "Synthetic Reviewer", image: null } },
        ],
      },
    }),
  }),
);
vi.mock("@/hooks/queries/favorite/use-favorites", () => ({
  useFavorite: () => ({ isFavorite: false, toggle: mocks.toggleFavorite }),
}));

const basePr = {
  owner: "acme",
  repo: "web",
  number: 7,
  title: "Add thing",
  url: "https://github.com/acme/web/pull/7",
  author: { login: "synthetic-author", avatarUrl: "" },
  reviewOwner: null,
  originalAuthorUserId: null,
  status: "open",
  headRef: "feat",
  baseRef: "main",
  updatedAt: "2026-01-01T00:00:00Z",
  comments: 2,
  hasConflicts: false,
  labels: [{ name: "bug", color: "d73a4a" }],
  reviewers: [
    { login: "synthetic-reviewer", avatarUrl: "" },
    { login: "cy", avatarUrl: "" },
  ],
  approvedBy: ["cy"],
  changesRequestedBy: [],
};

const owner = (userId: string) => ({ userId, name: userId, image: null });
const renderMenu = (pr: Record<string, unknown> = {}) => {
  render(
    <ContextMenu>
      <ContextMenuTrigger render={<div data-testid="row">row</div>} />
      <ReviewRowMenu
        pr={{ ...basePr, ...pr } as never}
        workspaceId="w1"
        onAction={mocks.onAction}
      />
    </ContextMenu>,
  );
  fireEvent.contextMenu(screen.getByTestId("row"));
};
const open = async (name: string) =>
  fireEvent.click(await screen.findByText(name));
const itemNames = () =>
  screen.getAllByRole("menuitem").map((el) => el.textContent?.trim());

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockClear());
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mocks.writeText },
    configurable: true,
  });
  useReviewsSnoozeStore.setState({ entries: {} });
});
afterEach(cleanup);

describe("ReviewRowMenu", () => {
  it("lists Linear's row items in order", async () => {
    renderMenu();
    await screen.findByText("Open on GitHub");
    expect(itemNames()).toEqual([
      "Open on GitHub",
      "Work on pull request",
      "Favorite",
      "Snooze",
      "Copy",
      "Checks",
      "Owner",
      "Labels",
      "Convert to draft",
      "Squash & merge",
      "Close pull request",
      "Select reviewers",
    ]);
  });

  it("favorites the pull request", async () => {
    renderMenu();
    await open("Favorite");
    expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("copies from the Copy submenu, with the branch from the list", async () => {
    renderMenu();
    await open("Copy");
    await open("Copy branch name");
    await waitFor(() => expect(mocks.writeText).toHaveBeenCalledWith("feat"));
  });

  it("lists checks by section with a filter", async () => {
    renderMenu();
    await open("Checks");
    expect(await screen.findByText("1 pending check")).toBeVisible();
    expect(screen.getByText("1 successful check")).toBeVisible();
    expect(screen.getByText("1 failed check")).toBeVisible();
    expect(screen.getByText("1m 5s")).toBeVisible();
    fireEvent.change(
      screen.getByPlaceholderText("Open pull request checks..."),
      {
        target: { value: "lint" },
      },
    );
    expect(screen.queryByText("CI / Test")).toBeNull();
    expect(screen.getByText("CI / Lint")).toBeVisible();
  });

  it("checks the owner, tags the original author, and shares the pick", async () => {
    renderMenu({ reviewOwner: owner("u2"), originalAuthorUserId: "u1" });
    await open("Owner");
    expect(
      await screen.findByRole("menuitemcheckbox", {
        name: /Synthetic Reviewer/,
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Synthetic Member/ }),
    ).not.toBeChecked();
    expect(screen.getByText("Original author")).toBeVisible();
    fireEvent.click(
      screen.getByRole("menuitemcheckbox", { name: /Synthetic Member/ }),
    );
    expect(mocks.setOwner.mock.calls[0][0]).toBeNull();
  });

  it("stores another member as the owner", async () => {
    renderMenu({ reviewOwner: owner("u1"), originalAuthorUserId: "u1" });
    await open("Owner");
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", {
        name: /Synthetic Reviewer/,
      }),
    );
    expect(mocks.setOwner.mock.calls[0][0]).toBe("u2");
  });

  it("sets labels on GitHub when one is toggled", async () => {
    renderMenu();
    await open("Labels");
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "docs" }),
    );
    expect(mocks.setLabels.mock.calls[0][0].sort()).toEqual(["bug", "docs"]);
  });

  it("requests a review, skipping the author", async () => {
    renderMenu();
    await open("Select reviewers");
    expect(
      screen.queryByRole("button", { name: "synthetic-author" }),
    ).toBeNull();
    fireEvent.click(
      await screen.findByRole("button", { name: /synthetic-second/ }),
    );
    expect(mocks.requestReviewers).toHaveBeenCalledWith(
      ["synthetic-second"],
      expect.anything(),
    );
  });

  it.each([
    ["Convert to draft", "draft"],
    ["Squash & merge", "squash"],
    ["Close pull request", "close"],
  ])("%s asks the list to confirm before writing", async (label, action) => {
    renderMenu();
    await open(label);
    expect(mocks.onAction).toHaveBeenCalledWith(action);
  });

  it("snoozes, then offers Change snooze and Unsnooze", async () => {
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

  it("offers no convert or squash on a draft", async () => {
    renderMenu({ status: "draft" });
    await screen.findByText("Close pull request");
    expect(screen.queryByText("Convert to draft")).toBeNull();
    expect(screen.queryByText("Squash & merge")).toBeNull();
  });

  it("disables squash on conflicts", async () => {
    renderMenu({ hasConflicts: true });
    const item = await screen.findByText("Squash & merge");
    expect(item.closest("[role=menuitem]")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it.each(["merged", "closed"])(
    "offers no GitHub write once %s",
    async (status) => {
      renderMenu({ status });
      await screen.findByText("Checks");
      expect(itemNames()).toEqual([
        "Open on GitHub",
        "Work on pull request",
        "Favorite",
        "Snooze",
        "Copy",
        "Checks",
        "Owner",
      ]);
    },
  );
});
