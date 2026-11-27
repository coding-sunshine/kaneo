import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { DesignReviewSection } from "./design-review-section";

const approve = vi.fn();
const withdraw = vi.fn();
let canUpdate = true;
let reviews: Array<{
  taskId: string;
  reviewerId: string;
  reviewerName: string | null;
  requesterId: string | null;
  status: "pending" | "approved";
  requestedAt: string;
  resolvedAt: string | null;
  slaDueAt: string;
}> = [];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.name ? `${key}:${options.name}` : key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/lib/format", () => ({ formatDateMedium: (d: string) => d }));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "me" } }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => canUpdate }),
}));

vi.mock("@/hooks/queries/design-review/use-get-design-reviews", () => ({
  default: () => ({ data: reviews }),
}));

vi.mock("@/hooks/mutations/design-review/use-approve-design-review", () => ({
  default: () => ({ mutate: approve, isPending: false }),
}));

vi.mock("@/hooks/mutations/design-review/use-withdraw-design-review", () => ({
  default: () => ({ mutate: withdraw, isPending: false }),
}));

vi.mock("./request-design-review-popover", () => ({
  RequestDesignReviewPopover: () => <button type="button">request</button>,
}));

afterEach(cleanup);

const review = (over: Partial<(typeof reviews)[number]>) => ({
  taskId: "t1",
  reviewerId: "me",
  reviewerName: "Me",
  requesterId: "u2",
  status: "pending" as const,
  requestedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  resolvedAt: null,
  slaDueAt: new Date(Date.now() + 45 * 3_600_000).toISOString(),
  ...over,
});

const task = { id: "t1", projectId: "p1" };

describe("DesignReviewSection", () => {
  beforeEach(() => {
    approve.mockReset();
    withdraw.mockReset();
    canUpdate = true;
    reviews = [];
  });

  it("lets the named reviewer approve their pending review", () => {
    reviews = [review({}), review({ reviewerId: "u3", reviewerName: "Other" })];
    render(<DesignReviewSection task={task} workspaceId="w1" />);

    expect(screen.getByText("Me")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
    expect(screen.getAllByText("3h")).toHaveLength(2);
    // A fresh request is well inside its two-day SLA: no risk shown.
    expect(screen.queryByRole("img")).toBeNull();
    const buttons = screen.getAllByRole("button", {
      name: "tasks:designReview.approve",
    });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(approve).toHaveBeenCalledWith({ taskId: "t1" });
  });

  it("shows an approved review without actions to approve", () => {
    reviews = [
      review({ status: "approved", resolvedAt: new Date().toISOString() }),
    ];
    render(<DesignReviewSection task={task} workspaceId="w1" />);
    expect(screen.getByText("tasks:designReview.approved")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "tasks:designReview.approve" }),
    ).toBeNull();
    // An approval stays on record: it cannot be withdrawn.
    expect(
      screen.queryByRole("button", { name: "tasks:designReview.withdraw:Me" }),
    ).toBeNull();
  });

  it("withdraws a request, and hides request and withdraw without task:update", () => {
    reviews = [review({ reviewerId: "u3", reviewerName: "Other" })];
    const { unmount } = render(
      <DesignReviewSection task={task} workspaceId="w1" />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "tasks:designReview.withdraw:Other",
      }),
    );
    expect(withdraw).toHaveBeenCalledWith({ taskId: "t1", reviewerId: "u3" });
    expect(screen.getByText("request")).toBeTruthy();
    unmount();

    canUpdate = false;
    render(<DesignReviewSection task={task} workspaceId="w1" />);
    expect(screen.queryByText("request")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "tasks:designReview.withdraw:Other",
      }),
    ).toBeNull();
  });
});
