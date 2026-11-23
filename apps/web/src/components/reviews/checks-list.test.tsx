import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import "@/lib/i18n";
import { ChecksList } from "./checks-list";

vi.mock("@/hooks/queries/github-reviews/use-github-reviews", () => ({
  usePullRequestChecks: () => ({
    data: {
      state: "failure",
      checks: [
        { name: "build", state: "success", url: null, durationSeconds: 111 },
        { name: "test", state: "success", url: null, durationSeconds: 5 },
        { name: "deploy", state: "pending", url: null, durationSeconds: null },
        {
          name: "lint",
          state: "failure",
          url: "https://x",
          durationSeconds: 9,
        },
      ],
    },
  }),
}));

afterEach(cleanup);
const ref = { owner: "a", repo: "b", number: "1" };

describe("ChecksList", () => {
  it("groups by state with counts and shows right-aligned durations", () => {
    render(<ChecksList pullRef={ref} />);
    expect(screen.getByText("1 failed check")).toBeVisible();
    expect(screen.getByText("1 pending check")).toBeVisible();
    expect(screen.getByText("2 successful checks")).toBeVisible();
    expect(screen.getByText("1m 51s")).toBeVisible();
  });

  it("filters by name", () => {
    render(<ChecksList pullRef={ref} />);
    fireEvent.change(
      screen.getByPlaceholderText("Open pull request checks..."),
      {
        target: { value: "dep" },
      },
    );
    expect(screen.getByText("deploy")).toBeVisible();
    expect(screen.queryByText("build")).toBeNull();
    expect(screen.queryByText("2 successful checks")).toBeNull();
  });
});
