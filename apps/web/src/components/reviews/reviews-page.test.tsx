import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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
import { DEFAULT_REVIEWS_VIEWS, REVIEWS_TABS } from "@/lib/reviews-view";
import { entryFor } from "@/lib/reviews-snooze";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";
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
  author: { login: "synthetic-author", avatarUrl: "" },
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
    reviewsTabOrder: REVIEWS_TABS,
  });
  useReviewsSnoozeStore.setState({ entries: {} });
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

  describe("snoozed reviews", () => {
    const hour = new Date(Date.now() + 3_600_000);
    const snooze = (number: number, when: Parameters<typeof entryFor>[1]) =>
      useReviewsSnoozeStore.setState({
        entries: {
          [`acme/web#${number}`]: entryFor(
            { updatedAt: "2026-01-02T00:00:00Z", comments: 0 },
            when,
          ),
        },
      });
    const showSnoozed = () =>
      useUserPreferencesStore.setState({
        reviewsView: {
          ...DEFAULT_REVIEWS_VIEWS,
          toReview: { ...DEFAULT_REVIEWS_VIEWS.toReview, showSnoozed: true },
        },
      });

    it("drops a snoozed row and the tab count", () => {
      snooze(1, { until: hour });
      render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
      expect(screen.queryByText("Review me")).not.toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "To review" }),
      ).toBeInTheDocument();
    });

    it("shows snoozed rows in a last Snoozed group when the option is on, with the clock tooltip", () => {
      snooze(1, { until: hour });
      state.list.toReview = [pr(1, "Review me"), pr(4, "Other")];
      showSnoozed();
      render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
      const headings = screen.getAllByRole("heading", { level: 2 });
      expect(headings.map((heading) => heading.textContent)).toEqual([
        "Needs your review1",
        "Snoozed1",
      ]);
      expect(screen.getByText("Review me")).toBeInTheDocument();
      expect(screen.getByText(/^Snoozed until /)).toBeInTheDocument();
    });

    it("lists an expired snooze as a normal row", () => {
      snooze(1, { until: new Date(Date.now() - 1000) });
      render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
      expect(screen.getByText("Review me")).toBeInTheDocument();
    });

    it("words the tooltip for until-new-comment", () => {
      snooze(1, { mode: "newComment" });
      showSnoozed();
      render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
      expect(
        screen.getByText("Snoozed until a new comment"),
      ).toBeInTheDocument();
    });
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
        reviewers: [{ login: "synthetic-reviewer", avatarUrl: "" }],
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
    expect(screen.getByTitle("synthetic-reviewer")).toBeInTheDocument();
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

  it("starts an advanced filter on or from the Filter menu", async () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(await screen.findByText("Advanced filter"));
    expect(
      useUserPreferencesStore.getState().reviewsView.toReview.advanced,
    ).toEqual({ operator: "or", conditions: [] });
    expect(
      await screen.findByRole("button", { name: "Remove advanced filter" }),
    ).toBeInTheDocument();
  });

  it("joins the advanced conditions with their operator", () => {
    state.list.toReview = [
      pr(1, "Ready one", "open", { mergeState: "ready" }),
      pr(2, "Blocked one", "open", { mergeState: "blocked" }),
      pr(3, "Conflicted one", "open", { hasConflicts: true }),
    ];
    const advanced = (operator: "and" | "or") =>
      useUserPreferencesStore.setState({
        reviewsView: {
          ...DEFAULT_REVIEWS_VIEWS,
          toReview: {
            ...DEFAULT_REVIEWS_VIEWS.toReview,
            advanced: {
              operator,
              conditions: [
                {
                  kind: "condition",
                  id: "c1",
                  subject: "mergeStatus",
                  values: ["blocked"],
                  negated: false,
                },
                {
                  kind: "condition",
                  id: "c2",
                  subject: "hasConflicts",
                  values: ["true"],
                  negated: false,
                },
              ],
            },
          },
        },
      });
    advanced("or");
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByText("2 conditions")).toBeInTheDocument();
    expect(screen.getByText("Blocked one")).toBeInTheDocument();
    expect(screen.getByText("Conflicted one")).toBeInTheDocument();
    expect(screen.queryByText("Ready one")).not.toBeInTheDocument();

    act(() => advanced("and"));
    expect(screen.queryByText("Blocked one")).not.toBeInTheDocument();
    expect(screen.queryByText("Conflicted one")).not.toBeInTheDocument();
  });

  it("narrows the list differently with a nested group than the same conditions flat", () => {
    state.list.toReview = [
      pr(1, "Open blocked", "open", { mergeState: "blocked" }),
      pr(2, "Open conflicted", "open", {
        mergeState: "ready",
        hasConflicts: true,
      }),
      pr(3, "Draft blocked", "draft", { mergeState: "blocked" }),
    ];
    useUserPreferencesStore.setState({
      reviewsView: {
        ...DEFAULT_REVIEWS_VIEWS,
        toReview: {
          ...DEFAULT_REVIEWS_VIEWS.toReview,
          advanced: {
            operator: "and",
            conditions: [
              {
                kind: "condition",
                id: "c1",
                subject: "status",
                values: ["open"],
                negated: false,
              },
              {
                kind: "group",
                id: "g1",
                operator: "or",
                conditions: [
                  {
                    kind: "condition",
                    id: "c2",
                    subject: "mergeStatus",
                    values: ["blocked"],
                    negated: false,
                  },
                  {
                    kind: "condition",
                    id: "c3",
                    subject: "hasConflicts",
                    values: ["true"],
                    negated: false,
                  },
                ],
              },
            ],
          },
        },
      },
    });
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByText("3 conditions")).toBeInTheDocument();
    expect(screen.getByText("Open blocked")).toBeInTheDocument();
    expect(screen.getByText("Open conflicted")).toBeInTheDocument();
    expect(screen.queryByText("Draft blocked")).not.toBeInTheDocument();
  });

  it("always shows owner/repo, author and branches under the title, with status details and #num when on", () => {
    state.list.toReview = [
      pr(7, "Two lines", "draft", { headRef: "feat", baseRef: "main" }),
    ];
    const withProperties = (properties: string[]) =>
      useUserPreferencesStore.setState({
        reviewsView: {
          ...DEFAULT_REVIEWS_VIEWS,
          toReview: {
            ...DEFAULT_REVIEWS_VIEWS.toReview,
            properties: properties as never,
          },
        },
      });
    withProperties(["date"]);
    const one = render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(
      screen.getByText("acme/web · synthetic-author · feat → main"),
    ).toBeInTheDocument();
    one.unmount();
    withProperties(["date", "id", "statusDetails"]);
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(
      screen.getByText("Draft · acme/web#7 · synthetic-author · feat → main"),
    ).toBeInTheDocument();
  });

  it("collapses and pins from the group header menu", async () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.contextMenu(
      screen.getByRole("button", { name: /Needs your review/ }),
    );
    expect(
      (await screen.findAllByRole("menuitem")).map((item) => item.textContent),
    ).toEqual(["Collapse", "Collapse all", "Pin to bottom"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Collapse all" }));
    expect(
      useUserPreferencesStore.getState().reviewsView.toReview.collapsed,
    ).toEqual(["focus:done", "focus:needsReview"]);
  });

  it("moves a tab from its menu and keeps the order", async () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.contextMenu(screen.getByRole("tab", { name: "Created" }));
    expect(
      (await screen.findAllByRole("menuitem")).map((item) => item.textContent),
    ).toEqual(["Copy link", "Move right"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move right" }));
    expect(useUserPreferencesStore.getState().reviewsTabOrder).toEqual([
      "toReview",
      "created",
    ]);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "To review1",
      "Created",
    ]);
  });

  it("drops a negated condition when its last value is unchecked", async () => {
    state.list.toReview = [
      pr(1, "Blocked one", "open", { mergeState: "blocked" }),
    ];
    useUserPreferencesStore.setState({
      reviewsView: {
        ...DEFAULT_REVIEWS_VIEWS,
        toReview: {
          ...DEFAULT_REVIEWS_VIEWS.toReview,
          filters: { mergeStatus: { values: ["blocked"], negated: true } },
        },
      },
    });
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(
      (await screen.findAllByText("Merge status")).at(-1) as HTMLElement,
    );
    fireEvent.click(
      (await screen.findAllByText("Blocked")).at(-1) as HTMLElement,
    );
    expect(
      useUserPreferencesStore.getState().reviewsView.toReview.filters,
    ).toEqual({});
  });

  it("keeps each tab's filters", async () => {
    state.list.toReview = [
      pr(1, "Ready one", "open", { mergeState: "ready" }),
      pr(2, "Blocked one", "open", { mergeState: "blocked" }),
    ];
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(await screen.findByText("Merge status"));
    fireEvent.click(await screen.findByText("Blocked"));
    const { reviewsView } = useUserPreferencesStore.getState();
    expect(reviewsView.toReview.filters.mergeStatus?.values).toEqual([
      "blocked",
    ]);
    expect(reviewsView.created.filters).toEqual({});
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
