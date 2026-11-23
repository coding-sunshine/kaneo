import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
// Loads the real English copy, so the assertions read like the page does.
import "@/lib/i18n";
import { ShortcutListener } from "@/lib/shortcuts/shortcut-listener";
import { DEFAULT_REVIEWS_VIEWS } from "@/lib/reviews-view";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ReviewsPage } from "./reviews-page";

const pr = (
  number: number,
  title: string,
  status = "open",
  extra: Record<string, unknown> = {},
) => ({
  owner: "acme",
  repo: "web",
  number,
  title,
  url: `https://github.com/acme/web/pull/${number}`,
  author: { login: "ada", avatarUrl: "" },
  status,
  comments: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  reviewDecision: null,
  checks: "none",
  additions: 3,
  deletions: 1,
  labels: [],
  reviewers: [],
  teamReviewers: [],
  approvedBy: [],
  changesRequestedBy: [],
  hasConflicts: false,
  mergeState: "unknown",
  teamRequested: false,
  issue: null,
  ...extra,
});

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {} as Record<string, string>,
}));

const state = vi.hoisted(() => ({
  status: { state: "connected", login: "octo" } as { state: string },
  list: {
    toReview: [] as unknown[],
    created: [] as unknown[],
    participated: [] as unknown[],
  },
}));

vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => ({
  useReviewsStatus: () => ({ data: state.status, isLoading: false }),
  useReviewsList: () => ({ data: state.list, isLoading: false }),
}));
// The real shell pulls in the whole sidebar; only its header row is used here.
vi.mock("@/components/common/layout", () => ({
  default: {
    Header: ({ children }: { children: React.ReactNode }) => (
      <header>{children}</header>
    ),
  },
}));
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => null }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a
      href="/pr"
      data-review-row={props["data-review-row"] as string}
      aria-current={props["aria-current"] as "page" | undefined}
    >
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));

beforeEach(() => {
  state.status = { state: "connected" };
  state.list = {
    toReview: [pr(1, "Review me")],
    created: [pr(2, "Mine"), pr(3, "Wip", "draft")],
    participated: [],
  };
  useUserPreferencesStore.setState({
    codeReviewsEnabled: true,
    reviewsView: DEFAULT_REVIEWS_VIEWS,
  });
  mocks.navigate.mockClear();
  mocks.params = {};
});
afterEach(cleanup);

describe("ReviewsPage", () => {
  it("shows the connect card when not connected", () => {
    state.status = { state: "needs_reconnect" };
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByTestId("reviews-connect-card")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("switches between To review and Created, grouped by status", () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByRole("tab", { name: "To review1" })).toBeInTheDocument();
    expect(screen.getByText("Review me")).toBeInTheDocument();
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Created" }));
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.getByText("Wip")).toBeInTheDocument();
    expect(screen.queryByText("Review me")).not.toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Draft1",
      "Open1",
    ]);
  });

  it("starts Done collapsed and collapses a group on click", () => {
    state.list.participated = [pr(9, "Already reviewed")];
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Needs your review1",
      "Done1",
    ]);
    expect(screen.queryByText("Already reviewed")).not.toBeInTheDocument();
    expect(screen.getByText("1 review")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Needs your review/ }));
    expect(screen.queryByText("Review me")).not.toBeInTheDocument();
    expect(screen.getByText("0 reviews")).toBeInTheDocument();
    expect(
      useUserPreferencesStore.getState().reviewsView.toReview.collapsed,
    ).toContain("focus:needsReview");
  });

  it("keeps pinned groups last", () => {
    useUserPreferencesStore.setState({
      reviewsView: {
        ...DEFAULT_REVIEWS_VIEWS,
        created: { ...DEFAULT_REVIEWS_VIEWS.created, pinned: ["status:draft"] },
      },
    });
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(screen.getByRole("tab", { name: "Created" }));
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Open1",
      "Draft1",
    ]);
  });

  it("shows the opened pull request beside the list", () => {
    mocks.params = { owner: "acme", repo: "web", number: "1" };
    render(
      <ReviewsPage returnTo="/r" workspaceId="w1">
        <p>Detail pane</p>
      </ReviewsPage>,
    );
    expect(screen.getByText("Detail pane")).toBeInTheDocument();
    expect(screen.queryByText("1 review")).not.toBeInTheDocument();
    expect(
      screen.getByText("Review me").closest("[data-review-row]"),
    ).toHaveAttribute("aria-current", "page");
  });

  it("filters rows by text", () => {
    state.list.toReview = [pr(1, "Fix login"), pr(2, "Add billing")];
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "billing" },
    });
    expect(screen.getByText("Add billing")).toBeInTheDocument();
    expect(screen.queryByText("Fix login")).not.toBeInTheDocument();
  });

  it("shows reviewers, GitHub team and labels when those properties are on", () => {
    state.list.toReview = [
      pr(1, "Chips", "open", {
        reviewers: [{ login: "bo", avatarUrl: "" }],
        teamReviewers: ["core"],
        labels: [{ name: "bug", color: "d73a4a" }],
      }),
    ];
    useUserPreferencesStore.setState({
      reviewsView: {
        ...DEFAULT_REVIEWS_VIEWS,
        toReview: {
          ...DEFAULT_REVIEWS_VIEWS.toReview,
          properties: ["reviewers", "githubTeam", "labels"],
        },
      },
    });
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByTitle("bo")).toBeInTheDocument();
    expect(screen.getByText("core")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
  });

  it("groups by the linked task priority, unlinked rows under No priority", () => {
    state.list.toReview = [
      pr(1, "Urgent one", "open", {
        issue: {
          taskId: "t1",
          title: "T",
          priority: "urgent",
          team: { id: "p1", name: "Eng" },
          project: null,
        },
      }),
      pr(2, "Loose one"),
    ];
    useUserPreferencesStore.setState({
      reviewsView: {
        ...DEFAULT_REVIEWS_VIEWS,
        toReview: { ...DEFAULT_REVIEWS_VIEWS.toReview, groupBy: "priority" },
      },
    });
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("No priority")).toBeInTheDocument();
  });

  it("saves the badge count options from the Display menu", async () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(screen.getByRole("button", { name: "Display" }));
    fireEvent.click(await screen.findByRole("button", { name: "Badge count" }));
    fireEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Ready to merge" }),
    );
    expect(useUserPreferencesStore.getState().sidebar.reviewsCount).toEqual([
      "requested",
      "team",
    ]);
  });

  it("narrows the list with the Merge status filter", async () => {
    state.list.toReview = [
      pr(1, "Ready one", "open", { mergeState: "ready" }),
      pr(2, "Blocked one", "open", { mergeState: "blocked" }),
    ];
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(await screen.findByText("Merge status"));
    fireEvent.click(await screen.findByText("Blocked"));
    expect(screen.getByText("Blocked one")).toBeInTheDocument();
    expect(screen.queryByText("Ready one")).not.toBeInTheDocument();
  });

  it("moves with j and k and opens the focused row with Enter", () => {
    state.list.toReview = [pr(1, "First"), pr(2, "Second")];
    render(
      <>
        <ShortcutListener />
        <ReviewsPage returnTo="/r" workspaceId="w1" />
      </>,
    );
    const key = (k: string) => fireEvent.keyDown(document.body, { key: k });
    key("j");
    expect(document.activeElement).toHaveAttribute(
      "data-review-row",
      "acme/web#1",
    );
    key("j");
    expect(document.activeElement).toHaveAttribute(
      "data-review-row",
      "acme/web#2",
    );
    key("k");
    expect(document.activeElement).toHaveAttribute(
      "data-review-row",
      "acme/web#1",
    );
    key("j");
    (document.activeElement as HTMLElement).blur();
    key("Enter");
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ number: "2" }),
      }),
    );
  });
});
