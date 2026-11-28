import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AiFeaturesCard } from "./ai-features-card";

const m = vi.hoisted(() => ({
  data: { triage: false, prSummary: true } as
    | { triage: boolean; prSummary: boolean }
    | undefined,
  mutate: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/agent/use-ai-features", () => ({
  useAiFeatures: () => ({ data: m.data }),
}));
vi.mock("@/hooks/mutations/agent/use-set-ai-features", () => ({
  useSetAiFeatures: () => ({ mutate: m.mutate, isPending: false }),
}));

afterEach(() => {
  cleanup();
  m.mutate.mockReset();
});

describe("AiFeaturesCard", () => {
  it("turns AI triage on and keeps the other switch as it is", () => {
    render(<AiFeaturesCard workspaceId="w1" />);
    fireEvent.click(
      screen.getByRole("switch", { name: "settings:aiUsage.switches.triage" }),
    );
    expect(m.mutate).toHaveBeenCalledWith(
      { triage: true, prSummary: true },
      expect.anything(),
    );
  });

  it("shows each switch as the workspace has it", () => {
    render(<AiFeaturesCard workspaceId="w1" />);
    const pr = screen.getByRole("switch", {
      name: "settings:aiUsage.switches.prSummary",
    });
    expect(pr.getAttribute("aria-checked")).toBe("true");
  });
});
