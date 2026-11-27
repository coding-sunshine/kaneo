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
  saveDocumentTemplate: vi.fn(),
  exportDocument: vi.fn(),
  downloadBlob: vi.fn(),
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
vi.mock("@/fetchers/document/templates", () => ({
  saveDocumentTemplate: mocks.saveDocumentTemplate,
}));
vi.mock("@/fetchers/document/export-document", () => ({
  exportDocument: mocks.exportDocument,
}));
vi.mock("@/lib/download-blob", () => ({ downloadBlob: mocks.downloadBlob }));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/work-project/use-get-work-projects", () => ({
  useGetWorkProjects: () => ({
    data: [
      { id: "wp-open", name: "Alpha launch", canOpenDocuments: true },
      { id: "wp-closed", name: "Beta launch", canOpenDocuments: false },
    ],
  }),
}));
vi.mock("@/hooks/mutations/document/use-document-mutations", () => ({
  useDeleteDocument: () => ({ mutate: vi.fn() }),
  useRestoreDocument: () => ({ mutate: vi.fn() }),
}));

const document = {
  id: "d1",
  workspaceId: "ws",
  title: "Release: plan",
  role: "view",
  scope: "workspace",
} as unknown as DocumentDetail;

const openMenu = (shown: DocumentDetail = document) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentOptionsMenu
        document={shown}
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

describe("DocumentOptionsMenu move", () => {
  it("offers only the projects the document can be moved to", async () => {
    mocks.getFavorites.mockResolvedValue([]);
    openMenu({ ...document, role: "edit" } as DocumentDetail);
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:documents.moveTo",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:documents.scopes.projects",
      }),
    );
    expect(
      await screen.findByRole("menuitem", { name: "Alpha launch" }),
    ).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Beta launch" })).toBeNull();
  });
});

describe("DocumentOptionsMenu template", () => {
  it("saves the page as a template, also for a reader", async () => {
    mocks.getFavorites.mockResolvedValue([]);
    mocks.saveDocumentTemplate.mockResolvedValue({ id: "t1" });
    openMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:documents.templates.saveAs",
      }),
    );
    await waitFor(() =>
      expect(mocks.saveDocumentTemplate).toHaveBeenCalledWith("ws", "d1"),
    );
  });

  it("does not offer a page that not every member can open", async () => {
    mocks.getFavorites.mockResolvedValue([]);
    openMenu({ ...document, scope: "team" } as DocumentDetail);
    await screen.findByRole("menuitem", {
      name: "navigation:documents.pins.pin",
    });
    expect(
      screen.queryByRole("menuitem", {
        name: "navigation:documents.templates.saveAs",
      }),
    ).toBeNull();
  });
});

describe("DocumentOptionsMenu delete", () => {
  it("asks what happens to the pages inside before deleting", async () => {
    mocks.getFavorites.mockResolvedValue([]);
    openMenu({
      ...document,
      role: "edit",
      hasChildren: true,
    } as DocumentDetail);
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "navigation:documents.delete",
      }),
    );
    expect(
      await screen.findByText("navigation:documents.pageTree.delete.title"),
    ).toBeTruthy();
  });
});

describe("DocumentOptionsMenu export", () => {
  it.each([
    ["markdown", "navigation:documents.export.markdown", "Release- plan.md"],
    ["pdf", "navigation:documents.export.pdf", "Release- plan.pdf"],
  ])(
    "downloads the page as %s, also for a reader",
    async (format, item, name) => {
      mocks.getFavorites.mockResolvedValue([]);
      const file = new Blob(["# Release: plan"]);
      mocks.exportDocument.mockResolvedValue(file);
      openMenu();
      fireEvent.click(
        await screen.findByRole("menuitem", {
          name: "navigation:documents.export.label",
        }),
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: item }));
      await waitFor(() =>
        expect(mocks.downloadBlob).toHaveBeenCalledWith(file, name),
      );
      expect(mocks.exportDocument).toHaveBeenCalledWith("ws", "d1", format);
    },
  );
});
