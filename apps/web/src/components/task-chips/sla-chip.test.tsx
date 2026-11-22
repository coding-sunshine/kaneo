import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SlaChip } from "./sla-chip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/format", () => ({ formatDateMedium: (d: string) => d }));

afterEach(cleanup);

describe("SlaChip", () => {
  it("renders nothing without an SLA", () => {
    const { container } = render(<SlaChip task={{ slaDueAt: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("flags a breached SLA", () => {
    render(<SlaChip task={{ slaDueAt: "2020-01-01T00:00:00Z" }} showLabel />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "tasks:sla.breached",
    );
    expect(screen.getByText("tasks:sla.breached")).toBeTruthy();
  });

  it("shows achieved once completed in time", () => {
    render(
      <SlaChip
        task={{
          slaDueAt: "2020-01-02T00:00:00Z",
          completedAt: "2020-01-01T00:00:00Z",
        }}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "tasks:sla.achieved",
    );
  });
});
