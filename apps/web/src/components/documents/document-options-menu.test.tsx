import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentOptionsMenu } from "./document-options-menu";

const mocks = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  setFavorite: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/fetchers/favorite", () => ({
  getFavorites: mocks.getFavorites,
  setFavorite: mocks.setFavorite,
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/work-project/use-get-work-projects", () => ({
  useGetWorkProjects: () => ({ data: [] }),
}));
vi.mock("@/hooks/mutations/document/use-document-mutations", () => ({
  useDeleteDocument: () => ({ mutate: vi.fn() }),
  useRestoreDocument: () => ({ mutate: vi.fn() }),
}));

const document = {
  id: "d1",
  workspaceId: "ws",
  role: "view",
  scope: "workspace",
} as unknown as DocumentDetail;

const openMenu = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentOptionsMenu
        document={document}
        historyOpen={false}
        onRename={vi.fn()}
        onShare={vi.fn()}
        onToggleHistory={vi.fn()}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "navigation:documents.options" }),
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentOptionsMenu pin", () => {
  it("pins a document that is not pinned", async () => {
    // A star is not a pin.
    mocks.getFavorites.mockResolvedValue([
      { id: "f", type: "document", targetId: "d1" },
    ]);
    mocks.setFavorite.mockResolvedValue({});
    openMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:documents.pins.pin",
      }),
    );
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "d1" },
        true,
      ),
    );
  });

  it("unpins a pinned document", async () => {
    mocks.getFavorites.mockResolvedValue([
      { id: "p", type: "documentPin", targetId: "d1" },
    ]);
    mocks.setFavorite.mockResolvedValue({});
    openMenu();
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", {
          name: "navigation:documents.pins.unpin",
        }),
      ).not.toBeNull(),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "navigation:documents.pins.unpin" }),
    );
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "d1" },
        false,
      ),
    );
  });
});
