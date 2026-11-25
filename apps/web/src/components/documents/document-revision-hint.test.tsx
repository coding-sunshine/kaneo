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
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentRevisionHint } from "./document-revision-hint";

const mocks = vi.hoisted(() => ({ decideDocumentLineage: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
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
vi.mock("@/fetchers/document/documents", () => ({
  decideDocumentLineage: mocks.decideDocumentLineage,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

type Link = NonNullable<DocumentDetail["revisionOf"]>;
const LINEAGE = "navigation:documents.lineage";
const show = (
  status: Link["status"] | null,
  { canEdit = true, title = "Launch plan" } = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentRevisionHint
        canEdit={canEdit}
        document={{
          workspaceId: "ws",
          id: "doc-2",
          revisionOf: status && { id: "doc-1", title, overlap: 76, status },
        }}
      />
    </QueryClientProvider>,
  ).container;
const button = (name: string) =>
  screen.queryByRole("button", { name: `${LINEAGE}.${name}` });
const click = (name: string) => {
  const found = button(name);
  if (!found) throw new Error(`no button ${name}`);
  fireEvent.click(found);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentRevisionHint", () => {
  it("says nothing without a link, or about a link somebody dismissed", () => {
    expect(show(null).textContent).toBe("");
    cleanup();
    expect(show("dismissed").textContent).toBe("");
  });

  it("names the document a text looks like a revision of, and asks", async () => {
    mocks.decideDocumentLineage.mockResolvedValue({});
    const text = show("proposed").textContent;

    expect(text).toContain(`${LINEAGE}.proposed`);
    expect(text).toContain(`${LINEAGE}.overlap {"percent":76}`);
    expect(
      screen.getByRole("link", { name: "Launch plan" }).getAttribute("href"),
    ).toBe("/document/doc-1");
    expect(button("undo")).toBeNull();

    click("confirm");
    await waitFor(() =>
      expect(mocks.decideDocumentLineage).toHaveBeenCalledWith(
        "ws",
        "doc-2",
        "confirmed",
      ),
    );
    click("dismiss");
    await waitFor(() =>
      expect(mocks.decideDocumentLineage).toHaveBeenLastCalledWith(
        "ws",
        "doc-2",
        "dismissed",
      ),
    );
  });

  it("shows a confirmed link as a fact that can be taken back", async () => {
    mocks.decideDocumentLineage.mockResolvedValue({});
    const text = show("confirmed", { title: "" }).textContent;

    expect(text).toContain(`${LINEAGE}.confirmed`);
    expect(text).not.toContain(`${LINEAGE}.overlap`);
    expect(
      screen.getByRole("link", { name: "navigation:documents.untitled" }),
    ).toBeTruthy();
    expect(button("confirm")).toBeNull();
    expect(button("dismiss")).toBeNull();

    click("undo");
    await waitFor(() =>
      expect(mocks.decideDocumentLineage).toHaveBeenCalledWith(
        "ws",
        "doc-2",
        "dismissed",
      ),
    );
  });

  it("only tells a reader who cannot edit", () => {
    const text = show("proposed", { canEdit: false }).textContent;

    expect(text).toContain(`${LINEAGE}.proposed`);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
