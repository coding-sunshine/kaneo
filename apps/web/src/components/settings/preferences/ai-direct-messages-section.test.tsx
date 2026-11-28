import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AiDirectMessagesSection } from "./ai-direct-messages-section";

const state = vi.hoisted(() => ({
  hasAgent: true,
  include: false,
  set: vi.fn(),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => state.hasAgent,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/catch-up/use-catch-up-preference", () => ({
  useCatchUpPreference: () => ({
    data: { includeDirectMessages: state.include },
  }),
  useSetCatchUpPreference: () => ({ mutate: state.set }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.hasAgent = true;
  state.include = false;
});

const toggle = () =>
  screen.getByRole("switch", {
    name: "settings:preferencesPage.aiDirectMessages",
  });

describe("AiDirectMessagesSection", () => {
  it("keeps direct messages out of AI answers until turned on", () => {
    render(<AiDirectMessagesSection />);
    expect(toggle()).not.toBeChecked();
    fireEvent.click(toggle());
    expect(state.set).toHaveBeenCalledWith(true);
  });

  it("turns them off again", () => {
    state.include = true;
    render(<AiDirectMessagesSection />);
    fireEvent.click(toggle());
    expect(state.set).toHaveBeenCalledWith(false);
  });

  it("is hidden when the server has no AI", () => {
    state.hasAgent = false;
    render(<AiDirectMessagesSection />);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
