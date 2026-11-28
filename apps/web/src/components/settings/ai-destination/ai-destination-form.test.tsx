import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AiDestination } from "@/fetchers/agent/ai-destination";
import { AiDestinationForm } from "./ai-destination-form";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/mutations/agent/use-set-ai-destination", () => ({
  useSetAiDestination: () => ({ mutate, isPending: false }),
}));

const destination = {
  provider: "self-hosted",
  model: "local-llm",
  host: null,
  openRouter: { configured: true },
  selfHosted: { configured: true },
  canChange: true,
  changedAt: null,
  changedBy: null,
} as AiDestination;

const saveButton = () =>
  screen.getByRole("button", { name: "settings:aiDestination.save" });

describe("AiDestinationForm", () => {
  afterEach(() => {
    cleanup();
    mutate.mockReset();
  });

  // Only a change is recorded in the AI audit, so nothing else may say saved.
  it("offers Save only once the destination differs from the saved one", () => {
    render(<AiDestinationForm workspaceId="ws" destination={destination} />);
    expect(saveButton()).toHaveProperty("disabled", true);

    const model = screen.getByLabelText(
      "settings:aiDestination.selfHostedModel",
    );
    fireEvent.change(model, { target: { value: "other-llm" } });
    expect(saveButton()).toHaveProperty("disabled", false);
    fireEvent.click(saveButton());
    expect(mutate).toHaveBeenCalledWith(
      { provider: "self-hosted", model: "other-llm" },
      expect.anything(),
    );

    fireEvent.change(model, { target: { value: " local-llm " } });
    expect(saveButton()).toHaveProperty("disabled", true);
  });
});
