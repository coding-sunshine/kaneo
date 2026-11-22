import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { ReviewsPage } from "./reviews-page";

const pr = (number: number, title: string, status = "open") => ({
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
});

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
vi.mock("@/components/page-title", () => ({ default: () => null }));

beforeEach(() => {
  state.status = { state: "connected" };
  state.list = {
    toReview: [pr(1, "Review me")],
    created: [pr(2, "Mine"), pr(3, "Wip", "draft")],
    participated: [],
  };
  useUserPreferencesStore.setState({ codeReviewsEnabled: true });
});
afterEach(cleanup);

describe("ReviewsPage", () => {
  it("shows the connect card when not connected", () => {
    state.status = { state: "needs_reconnect" };
    render(<ReviewsPage returnTo="/r" />);
    expect(screen.getByTestId("reviews-connect-card")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("switches between To Review and Created, grouped by status", () => {
    render(<ReviewsPage returnTo="/r" />);
    expect(screen.getByText("Review me")).toBeInTheDocument();
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Created" }));
    expect(screen.getByText("Mine")).toBeInTheDocument();
    expect(screen.getByText("Wip")).toBeInTheDocument();
    expect(screen.queryByText("Review me")).not.toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Open1",
      "Draft1",
    ]);
  });

  it("hides Reviews when the user says they do not do code review", () => {
    render(<ReviewsPage returnTo="/r" />);
    fireEvent.click(
      screen.getByRole("button", { name: "I don't do code review" }),
    );
    expect(useUserPreferencesStore.getState().codeReviewsEnabled).toBe(false);
  });
});
