import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AiTriageCard } from "./ai-triage-card";

const m = vi.hoisted(() => ({ autoApply: false }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ setQueryData: vi.fn() }),
}));
vi.mock("@/hooks/queries/agent/use-ai-triage-settings", () => ({
  aiTriageSettingsKey: () => [],
  useAiTriageSettings: () => ({
    data: { guidance: "", autoApply: m.autoApply },
  }),
}));
vi.mock("@/components/settings/settings-card", () => ({
  SettingsCard: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

afterEach(cleanup);

describe("AiTriageCard", () => {
  it("warns that ticket text can steer the fields while auto-apply is on", () => {
    m.autoApply = true;
    render(<AiTriageCard workspaceId="w1" projectId="p1" />);
    expect(
      screen.getByText("settings:projectTriage.ai.autoApplyWarning"),
    ).toBeTruthy();
  });

  it("says nothing while auto-apply is off", () => {
    m.autoApply = false;
    render(<AiTriageCard workspaceId="w1" projectId="p1" />);
    expect(
      screen.queryByText("settings:projectTriage.ai.autoApplyWarning"),
    ).toBeNull();
  });
});
