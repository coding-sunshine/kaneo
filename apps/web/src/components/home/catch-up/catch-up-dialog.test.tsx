import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CatchUpDialog } from "./catch-up-dialog";

const state = vi.hoisted(() => ({
  hasAgent: true,
  catchUp: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => state.hasAgent,
}));
vi.mock("@/fetchers/catch-up/catch-up", () => ({
  catchUp: (...args: unknown[]) => state.catchUp(...args),
}));
vi.mock("@/hooks/queries/catch-up/use-catch-up-preference", () => ({
  useCatchUpPreference: () => ({ data: { includeDirectMessages: false } }),
  useSetCatchUpPreference: () => ({
    mutate: state.setPreference,
    isPending: false,
  }),
}));

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatchUpDialog workspaceId="ws1" />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.hasAgent = true;
});

describe("CatchUpDialog", () => {
  it("runs a 24 hour catch-up and links each bullet", async () => {
    state.catchUp.mockResolvedValue({
      bullets: [
        {
          text: "A vendor was chosen",
          sources: [
            {
              kind: "message",
              restricted: false,
              id: "m1",
              channelId: "c1",
              channelName: "x",
            },
          ],
        },
      ],
    });
    renderDialog();
    fireEvent.click(screen.getByText("workspace:home.catchUp.open"));
    fireEvent.click(await screen.findByText("workspace:home.catchUp.run"));
    expect(await screen.findByText("A vendor was chosen")).toBeTruthy();
    expect(state.catchUp).toHaveBeenCalledWith("ws1", 24);
    expect(screen.getByText("x")).toBeTruthy();
  });

  it("says AI is off when the server has no model", async () => {
    state.hasAgent = false;
    renderDialog();
    fireEvent.click(screen.getByText("workspace:home.catchUp.open"));
    expect(await screen.findByText("workspace:home.catchUp.off")).toBeTruthy();
    expect(screen.queryByText("workspace:home.catchUp.run")).toBeNull();
  });
});
