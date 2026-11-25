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
    hash,
  }: {
    children: ReactNode;
    params: { documentId: string };
    hash?: string;
  }) => (
    <a href={`/document/${params.documentId}${hash ? `#${hash}` : ""}`}>
      {children}
    </a>
  ),
}));

const show = (document: Partial<DocumentSummary>, taskId?: string) =>
  render(
    <DocumentResourceRow
      workspaceId="ws"
      taskId={taskId}
      document={
        {
          id: "doc-1",
          title: "Launch plan",
          status: "current",
          updatedAt: "2026-11-20T00:00:00Z",
          currentDocumentId: null,
          scope: "team",
          parentName: "Alpha",
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

  it("names the place that decides who can open it", () => {
    show({});
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(
      screen.getByTitle("navigation:documents.accessLabel.hint.team"),
    ).toBeTruthy();
    cleanup();
    show({ scope: "private", parentName: null });
    expect(
      screen.getByText("navigation:documents.accessLabel.private"),
    ).toBeTruthy();
  });

  it("opens the document at the line of the issue", () => {
    show({}, "t1");
    expect(screen.getAllByRole("link")[0]?.getAttribute("href")).toBe(
      "/document/doc-1#issue-t1",
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
