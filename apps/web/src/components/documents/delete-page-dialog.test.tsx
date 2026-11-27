import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DeletePageDialog } from "./delete-page-dialog";

const mocks = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  onDeleted: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  deleteDocument: mocks.deleteDocument,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const KEY = "navigation:documents.pageTree.delete";

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeletePageDialog
        workspaceId="ws"
        id="d1"
        onClose={vi.fn()}
        onDeleted={mocks.onDeleted}
      />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DeletePageDialog", () => {
  it("moves the pages below up by default", async () => {
    mocks.deleteDocument.mockResolvedValue({ id: "d1" });
    show();
    fireEvent.click(screen.getByRole("button", { name: `${KEY}.confirm` }));
    await waitFor(() =>
      expect(mocks.deleteDocument).toHaveBeenCalledWith("ws", "d1", "lift"),
    );
    await waitFor(() => expect(mocks.onDeleted).toHaveBeenCalled());
  });

  it("deletes the pages below when asked to", async () => {
    mocks.deleteDocument.mockResolvedValue({ id: "d1" });
    show();
    fireEvent.click(
      screen.getByRole("radio", { name: `${KEY}.deleteChildren` }),
    );
    fireEvent.click(screen.getByRole("button", { name: `${KEY}.confirm` }));
    await waitFor(() =>
      expect(mocks.deleteDocument).toHaveBeenCalledWith("ws", "d1", "delete"),
    );
  });
});
