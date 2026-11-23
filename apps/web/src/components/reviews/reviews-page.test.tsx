import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ShortcutListener } from "@/lib/shortcuts/shortcut-listener";
import { DEFAULT_REVIEWS_VIEW } from "@/lib/reviews-view";
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
  ...extra,
});

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

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
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({
    children,
    headerActions,
  }: {
    children: React.ReactNode;
    headerActions: React.ReactNode;
  }) => (
    <>
      {headerActions}
      {children}
    </>
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <a href="/pr" data-review-row={props["data-review-row"] as string}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
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
    reviewsView: DEFAULT_REVIEWS_VIEW,
  });
  mocks.navigate.mockClear();
});
afterEach(cleanup);

describe("ReviewsPage", () => {
  it("shows the connect card when not connected", () => {
    state.status = { state: "needs_reconnect" };
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    expect(screen.getByTestId("reviews-connect-card")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("switches between To Review and Created, grouped by status", () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
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

  it("hides Reviews when the user says they do not do code review", () => {
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "I don't do code review" }),
    );
    expect(useUserPreferencesStore.getState().codeReviewsEnabled).toBe(false);
  });

  it("groups by review status, with pinned groups last", () => {
    state.list = {
      toReview: [
        pr(1, "A", "open", { reviewDecision: "approved" }),
        pr(2, "B", "open", { reviewDecision: "changes_requested" }),
        pr(3, "C", "open"),
      ],
      created: [],
      participated: [],
    };
    useUserPreferencesStore.setState({
      reviewsView: {
        ...DEFAULT_REVIEWS_VIEW,
        groupBy: "reviewStatus",
        pinned: ["reviewStatus:changes_requested"],
      },
    });
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Approved1",
      "No review decision1",
      "Changes requested1",
    ]);
  });

  it("filters rows by text", () => {
    state.list.toReview = [pr(1, "Fix login"), pr(2, "Add billing")];
    render(<ReviewsPage returnTo="/r" workspaceId="w1" />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "billing" },
    });
    expect(screen.getByText("Add billing")).toBeInTheDocument();
    expect(screen.queryByText("Fix login")).not.toBeInTheDocument();
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
