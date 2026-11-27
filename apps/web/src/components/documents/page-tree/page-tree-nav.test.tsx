import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PageTreeNav } from "./page-tree-nav";

const state = vi.hoisted(() => ({
  onDragEnd: null as null | ((event: unknown) => void),
  getDocumentPageTree: vi.fn(),
  moveDocumentPage: vi.fn(),
  createDocument: vi.fn(),
}));

vi.mock("@dnd-kit/core", async () => ({
  ...(await vi.importActual<object>("@dnd-kit/core")),
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
  }) => {
    state.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  DragOverlay: () => null,
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/fetchers/document/documents", () => ({
  getDocumentPageTree: state.getDocumentPageTree,
  moveDocumentPage: state.moveDocumentPage,
  createDocument: state.createDocument,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const row = (id: string, title: string, parentDocumentId: string | null) => ({
  id,
  title,
  icon: null,
  parentDocumentId,
});

const show = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SidebarProvider>
        <PageTreeNav workspaceId="w1" />
      </SidebarProvider>
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PageTreeNav", () => {
  it("shows each page under its parent", async () => {
    state.getDocumentPageTree.mockResolvedValue([
      row("h", "Handbook", null),
      row("o", "Onboarding", "h"),
    ]);
    show();
    const handbook = (await screen.findByText("Handbook")).closest("li");
    expect(handbook).not.toBeNull();
    expect(
      within(handbook as HTMLElement).getByText("Onboarding"),
    ).toBeTruthy();
  });

  it("adds a page under another one", async () => {
    state.getDocumentPageTree.mockResolvedValue([row("h", "Handbook", null)]);
    state.createDocument.mockResolvedValue({ id: "n" });
    show();
    await screen.findByText("Handbook");
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.pageTree.addChild",
      }),
    );
    await waitFor(() =>
      expect(state.createDocument).toHaveBeenCalledWith({
        workspaceId: "w1",
        parentDocumentId: "h",
      }),
    );
  });

  it("moves a page that is dropped on another one, or on the top", async () => {
    state.getDocumentPageTree.mockResolvedValue([
      row("h", "Handbook", null),
      row("o", "Onboarding", "h"),
      row("p", "Policies", null),
    ]);
    state.moveDocumentPage.mockResolvedValue({ id: "o" });
    show();
    await screen.findByText("Policies");
    state.onDragEnd?.({ active: { id: "o" }, over: { id: "p" } });
    await waitFor(() =>
      expect(state.moveDocumentPage).toHaveBeenCalledWith("w1", "o", "p"),
    );
    state.onDragEnd?.({ active: { id: "o" }, over: { id: "root" } });
    await waitFor(() =>
      expect(state.moveDocumentPage).toHaveBeenCalledWith("w1", "o", null),
    );
  });

  it("ignores a drop under the page's own child", async () => {
    state.getDocumentPageTree.mockResolvedValue([
      row("h", "Handbook", null),
      row("o", "Onboarding", "h"),
    ]);
    show();
    await screen.findByText("Onboarding");
    state.onDragEnd?.({ active: { id: "h" }, over: { id: "o" } });
    expect(state.moveDocumentPage).not.toHaveBeenCalled();
  });
});
