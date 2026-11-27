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
import { DocumentTable } from "./document-table";

const mocks = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  setFavorite: vi.fn(),
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

const doc = (id: string) =>
  ({
    id,
    title: `Doc ${id}`,
    status: "current",
    scope: "project",
    parentName: "Evidence lineage",
    updatedAt: new Date().toISOString(),
  }) as unknown as DocumentSummary;

const show = (documents = [doc("a"), doc("b")]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentTable workspaceId="ws" documents={documents} />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentTable", () => {
  it("has Linear's columns, a group per time and where each document lives", () => {
    mocks.getFavorites.mockResolvedValue([]);
    show();
    for (const column of ["name", "visibility", "lastActivity"]) {
      expect(
        screen.getByText(`navigation:documents.columns.${column}`),
      ).toBeTruthy();
    }
    const group = screen.getByRole("button", {
      name: /navigation:documents.groups.thisWeek/,
    });
    expect(group.textContent).toContain("2");
    expect(screen.getAllByText("Evidence lineage")).toHaveLength(2);
    expect(screen.getAllByText("navigation:documents.editedOn")).toHaveLength(
      2,
    );
  });

  it("folds a group away and back", () => {
    mocks.getFavorites.mockResolvedValue([]);
    show();
    const group = screen.getByRole("button", {
      name: /navigation:documents.groups.thisWeek/,
    });
    expect(group.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(group);
    expect(group.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Doc a")).toBeNull();
    fireEvent.click(group);
    expect(screen.getByText("Doc a")).toBeTruthy();
  });

  it("pins the documents ticked on their rows", async () => {
    mocks.getFavorites.mockResolvedValue([]);
    mocks.setFavorite.mockResolvedValue({});
    show();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[1]);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:documents.pins.pin" }),
    );
    await waitFor(() =>
      expect(mocks.setFavorite).toHaveBeenCalledWith(
        "ws",
        { type: "documentPin", targetId: "b" },
        true,
      ),
    );
    expect(mocks.setFavorite).toHaveBeenCalledTimes(1);
  });
});
