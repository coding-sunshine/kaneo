import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InboxDocument } from "./inbox-document";

const queries = vi.hoisted(() => ({ document: vi.fn(), comments: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    params,
    children,
  }: {
    params: { documentId: string };
    children?: ReactNode;
  }) => <a href={`/document/${params.documentId}`}>{children}</a>,
}));
vi.mock("@/hooks/queries/document/use-documents", () => ({
  useDocument: queries.document,
  useDocumentComments: queries.comments,
}));
vi.mock("@/hooks/mutations/document/use-document-mutations", () => ({
  useCreateDocumentComment: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/lib/shortcuts/use-shortcut", () => ({ useShortcut: vi.fn() }));
vi.mock("./inbox-document-questions", () => ({
  InboxDocumentQuestions: ({ document }: { document: { id: string } }) => (
    <p>questions of {document.id}</p>
  ),
}));
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));
vi.mock("@/components/documents/document-comment-thread", () => ({
  DocumentCommentThread: ({ root }: { root: { content: string } }) => (
    <article>{root.content}</article>
  ),
}));
vi.mock("@/components/documents/document-comment-composer", () => ({
  DocumentCommentComposer: () => <textarea aria-label="composer" />,
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("inbox document", () => {
  it("shows the document, its open threads and a link to it", () => {
    queries.document.mockReturnValue({
      data: {
        id: "doc-1",
        title: "Brief",
        content: "Body",
        role: "edit",
        scope: "private",
        parentName: null,
      },
    });
    queries.comments.mockReturnValue({
      data: [
        { id: "c1", parentId: null, resolvedAt: null, content: "Open one" },
        { id: "c2", parentId: null, resolvedAt: "2026-01-01", content: "Done" },
      ],
    });
    render(<InboxDocument workspaceId="ws-1" documentId="doc-1" />);
    expect(screen.getByRole("heading", { name: "Brief" })).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Open one")).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.getByText("questions of doc-1")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /notifications:inbox.openDocument/ })
        .getAttribute("href"),
    ).toBe("/document/doc-1");
    expect(screen.getByLabelText("composer")).toBeTruthy();
  });

  it("says who can open the document", () => {
    queries.document.mockReturnValue({
      data: {
        id: "doc-1",
        title: "Brief",
        content: "",
        role: "view",
        scope: "team",
        parentName: "Alpha",
      },
    });
    queries.comments.mockReturnValue({ data: [] });
    render(<InboxDocument workspaceId="ws-1" documentId="doc-1" />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(
      screen.getByText("navigation:documents.accessLabel.team:"),
    ).toBeTruthy();
  });

  it("says when the document is gone", () => {
    queries.document.mockReturnValue({ data: undefined, isLoading: false });
    queries.comments.mockReturnValue({ data: [] });
    render(<InboxDocument workspaceId="ws-1" documentId="doc-1" />);
    expect(screen.getByRole("alert").textContent).toBe(
      "notifications:inbox.documentUnavailable",
    );
  });
});
