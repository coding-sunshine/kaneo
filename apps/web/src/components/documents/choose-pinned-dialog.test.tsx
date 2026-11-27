import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { ChoosePinnedDialog } from "./choose-pinned-dialog";

const mocks = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  setFavorite: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/favorite", () => ({
  getFavorites: mocks.getFavorites,
  setFavorite: mocks.setFavorite,
}));

const documents = [
  { id: "a", title: "Alpha plan" },
  { id: "b", title: "Beta notes" },
] as unknown as DocumentSummary[];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChoosePinnedDialog", () => {
  it("pins a ticked document, unpins an unticked one, and searches by title", async () => {
    mocks.getFavorites.mockResolvedValue([
      { id: "p", type: "documentPin", targetId: "b" },
    ]);
    mocks.setFavorite.mockResolvedValue({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChoosePinnedDialog
          workspaceId="ws"
          documents={documents}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("checkbox")[1].getAttribute("aria-checked"),
      ).toBe("true"),
    );
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "a" },
        true,
      ),
    );
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "b" },
        false,
      ),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "navigation:documents.pins.search" }),
      { target: { value: "beta" } },
    );
    expect(screen.queryByText("Alpha plan")).toBeNull();
    expect(screen.getByText("Beta notes")).toBeTruthy();
  });
});
