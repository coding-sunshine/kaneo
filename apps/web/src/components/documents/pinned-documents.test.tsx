import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { PinnedDocuments } from "./pinned-documents";

const mocks = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  setFavorite: vi.fn(),
  getDocument: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/fetchers/favorite", () => ({
  getFavorites: mocks.getFavorites,
  setFavorite: mocks.setFavorite,
}));
vi.mock("@/fetchers/document/documents", () => ({
  getDocument: mocks.getDocument,
}));

const recent = [
  { id: "newest", title: "Newest" },
  { id: "older", title: "Older" },
] as unknown as DocumentSummary[];

const show = (onChoose = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PinnedDocuments
        workspaceId="ws"
        documents={recent}
        onChoose={onChoose}
      />
    </QueryClientProvider>,
  );
  return onChoose;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PinnedDocuments", () => {
  it("offers to pin the most recent document or choose some when nothing is pinned", async () => {
    // A starred document is a favorite, not a pin.
    mocks.getFavorites.mockResolvedValue([
      { id: "f1", type: "document", targetId: "older" },
    ]);
    mocks.setFavorite.mockResolvedValue({});
    const onChoose = show();
    await screen.findByText("navigation:documents.pins.emptyTitle");
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.pins.pinMostRecent",
      }),
    );
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "newest" },
        true,
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:documents.pins.choose" }),
    );
    expect(onChoose).toHaveBeenCalled();
  });

  it("shows a card per pinned document with a preview of its body, and unpins it", async () => {
    mocks.getFavorites.mockResolvedValue([
      { id: "p1", type: "documentPin", targetId: "older" },
    ]);
    mocks.getDocument.mockResolvedValue({
      id: "older",
      title: "Older",
      content: "## Executive assessment\n\nIt holds up.",
      updatedAt: new Date().toISOString(),
    });
    mocks.setFavorite.mockResolvedValue({});
    show();
    expect(await screen.findByText("Older")).toBeTruthy();
    expect(screen.getByText("Executive assessment")).toBeTruthy();
    expect(screen.getByText("It holds up.")).toBeTruthy();
    expect(
      screen.queryByText("navigation:documents.pins.emptyTitle"),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:documents.pins.unpin" }),
    );
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "older" },
        false,
      ),
    );
  });
});
