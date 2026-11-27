import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { FavoritesNav } from "./favorites-nav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: ReactNode }) => (
    <a href="/favorite">{children}</a>
  ),
}));
vi.mock("@/components/ui/sidebar", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    SidebarGroup: Pass,
    SidebarGroupContent: Pass,
    SidebarGroupLabel: Pass,
    SidebarMenu: ({ children }: { children?: ReactNode }) => (
      <ul>{children}</ul>
    ),
    SidebarMenuItem: ({ children }: { children?: ReactNode }) => (
      <li>{children}</li>
    ),
    SidebarMenuButton: ({
      children,
    }: {
      render: ReactElement;
      children?: ReactNode;
    }) => <span>{children}</span>,
  };
});
vi.mock("@/hooks/queries/favorite/use-favorites", () => ({
  useFavorites: () => ({
    data: [
      { id: "f1", type: "document", targetId: "d1" },
      { id: "f2", type: "document", targetId: "d2" },
    ],
  }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/view/use-views", () => ({
  useViews: () => ({ data: [] }),
}));
vi.mock("@/fetchers/document/documents", () => ({
  getDocument: (_workspaceId: string, id: string) =>
    Promise.resolve(
      id === "d1"
        ? { id, title: "Roadmap", scope: "team", parentName: "Alpha" }
        : { id, title: "Notes", scope: "private", parentName: null },
    ),
}));

afterEach(cleanup);

describe("FavoritesNav", () => {
  it("says who can open each starred document", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FavoritesNav workspaceId="ws" />
      </QueryClientProvider>,
    );
    const roadmap = (await screen.findByText("Roadmap")).closest("li");
    expect(roadmap?.textContent).toContain(
      "navigation:documents.accessLabel.team:",
    );
    expect(roadmap?.textContent).toContain("Alpha");
    const notes = screen.getByText("Notes").closest("li");
    expect(notes?.textContent).toContain(
      "navigation:documents.accessLabel.private",
    );
  });
});
