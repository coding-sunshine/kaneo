import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SlaAgeChip } from "./sla-age-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { age?: string }) =>
      options?.age ? `${key}:${options.age}` : key,
    i18n: { language: "en-US" },
  }),
}));

vi.mock("@/lib/format", () => ({ formatDateMedium: (d: string) => d }));

afterEach(cleanup);

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

describe("SlaAgeChip", () => {
  it("shows the age and the SLA state", () => {
    render(
      <SlaAgeChip
        task={{ createdAt: hoursAgo(3), slaDueAt: "2020-01-01T00:00:00Z" }}
      />,
    );
    expect(screen.getByText("3h")).toBeTruthy();
    expect(screen.getByTitle("tasks:sla.ageTitle:3h")).toBeTruthy();
    expect(screen.getByText("tasks:sla.breached")).toBeTruthy();
  });

  it("says when a request has no SLA", () => {
    render(<SlaAgeChip task={{ createdAt: hoursAgo(1), slaDueAt: null }} />);
    expect(screen.getByText("tasks:sla.none")).toBeTruthy();
  });
});
