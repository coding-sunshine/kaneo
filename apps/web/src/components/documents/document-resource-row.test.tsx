import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentSummary } from "@/fetchers/document/documents";
import { DocumentResourceRow } from "./document-resource-row";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { documentId: string };
  }) => <a href={`/document/${params.documentId}`}>{children}</a>,
}));

const show = (document: Partial<DocumentSummary>) =>
  render(
    <DocumentResourceRow
      workspaceId="ws"
      document={
        {
          id: "doc-1",
          title: "Launch plan",
          status: "current",
          updatedAt: "2026-11-20T00:00:00Z",
          currentDocumentId: null,
          ...document,
        } as DocumentSummary
      }
    />,
  );

afterEach(cleanup);

describe("DocumentResourceRow", () => {
  it("says how far the document can be relied on", () => {
    show({});
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/document/doc-1");
    expect(links[0]?.textContent).toContain("Launch plan");
    expect(links[0]?.textContent).toContain(
      "navigation:documents.status.current",
    );
  });

  it("points from a replaced document to the one that replaced it", () => {
    show({ status: "superseded", currentDocumentId: "doc-2" });
    expect(
      screen.getByText("navigation:documents.status.superseded"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "navigation:documents.banner.openCurrent" })
        .getAttribute("href"),
    ).toBe("/document/doc-2");
  });
});
