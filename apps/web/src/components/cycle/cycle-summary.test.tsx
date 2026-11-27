import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CycleSummary } from "./cycle-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

afterEach(cleanup);

describe("CycleSummary", () => {
  it("shows the three team counts and nothing per person", () => {
    render(
      <CycleSummary
        summary={{ completed: 5, addedAfterStart: 2, carriedOver: 3 }}
      />,
    );
    const region = screen.getByRole("region", {
      name: "workspace:cycles.summary.title",
    });
    const items = Array.from(region.querySelectorAll("dd")).map(
      (dd) => dd.textContent,
    );
    expect(items).toEqual(["5", "2", "3"]);
    expect(region.textContent).toContain("workspace:cycles.summary.completed");
    expect(region.textContent).toContain(
      "workspace:cycles.summary.addedAfterStart",
    );
    expect(region.textContent).toContain(
      "workspace:cycles.summary.carriedOver",
    );
    expect(region.textContent).not.toContain("%");
    expect(region.textContent?.toLowerCase()).not.toContain("contributor");
  });
});
