import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { NewDocuments } from "./new-documents";

const mocks = vi.hoisted(() => ({
  getNewDocuments: vi.fn(),
  markDocumentsSeen: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/fetchers/document/documents", () => ({
  getNewDocuments: mocks.getNewDocuments,
  markDocumentsSeen: mocks.markDocumentsSeen,
}));

const HEADING = "navigation:documents.newSinceVisit";
const doc = (
  id: string,
  status: DocumentSummary["status"],
  filedAt: string,
  approvedAt: string | null = null,
) =>
  ({
    id,
    title: id,
    status,
    parentName: "Growth",
    creatorName: "Ada",
    creatorImage: null,
    filedAt,
    approvedAt,
    createdAt: filedAt,
    updatedAt: filedAt,
  }) as unknown as DocumentSummary;

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewDocuments workspaceId="ws" />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("NewDocuments", () => {
  it("lists what is new and records the newest change as seen", async () => {
    mocks.markDocumentsSeen.mockResolvedValue({});
    mocks.getNewDocuments.mockResolvedValue([
      // Filed first, approved last: the approval is when it became news.
      doc(
        "Approved",
        "current",
        "2026-11-01T09:00:00.000Z",
        "2026-11-09T09:00:00.000Z",
      ),
      doc("Proposed", "in_review", "2026-11-05T09:00:00.000Z"),
    ]);
    show();

    expect(await screen.findByRole("region", { name: HEADING })).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Proposed")).toBeTruthy();
    await waitFor(() =>
      expect(mocks.markDocumentsSeen).toHaveBeenCalledWith(
        "ws",
        "2026-11-09T09:00:00.000Z",
      ),
    );
    expect(mocks.markDocumentsSeen).toHaveBeenCalledTimes(1);
  });

  it("shows nothing and records nothing when nothing is new", async () => {
    mocks.getNewDocuments.mockResolvedValue([]);
    show();

    await waitFor(() => expect(mocks.getNewDocuments).toHaveBeenCalled());
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(mocks.markDocumentsSeen).not.toHaveBeenCalled();
  });
});
