import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SemanticSearchCard } from "./semantic-search-card";

const state = vi.hoisted(() => ({
  data: undefined as { enabled: boolean; egressAllowed: boolean } | undefined,
  save: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/semantic-search/use-semantic-search-setting", () => ({
  useSemanticSearchSetting: () => ({ data: state.data }),
  useSetSemanticSearchSetting: () => ({ mutate: state.save, isPending: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SemanticSearchCard", () => {
  it("is off by default and turns on", () => {
    state.data = { enabled: false, egressAllowed: true };
    render(<SemanticSearchCard workspaceId="ws1" />);
    fireEvent.click(screen.getByLabelText("settings:semanticSearch.title"));
    expect(state.save).toHaveBeenCalledWith(true, expect.anything());
  });

  it("cannot be turned on when the workspace keeps its text in house", () => {
    state.data = { enabled: false, egressAllowed: false };
    render(<SemanticSearchCard workspaceId="ws1" />);
    expect(
      screen.getByText("settings:semanticSearch.egressBlocked"),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText("settings:semanticSearch.title"));
    expect(state.save).not.toHaveBeenCalled();
  });

  it("shows nothing when the server has no embedding service", () => {
    state.data = undefined;
    const { container } = render(<SemanticSearchCard workspaceId="ws1" />);
    expect(container.textContent).toBe("");
  });
});
