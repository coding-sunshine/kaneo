import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentReplaceIntent } from "./document-replace-intent";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
  }: {
    params: Record<string, string>;
    children: ReactNode;
  }) => <a href={`/${params.documentId}`}>{children}</a>,
}));

const KEY = "navigation:documents.replaceIntent";

describe("DocumentReplaceIntent", () => {
  afterEach(cleanup);

  it("links the document a proposal means to replace", () => {
    render(
      <DocumentReplaceIntent
        workspaceId="ws-1"
        targetId="doc-0"
        title="Launch plan v2"
        stale={false}
      />,
    );
    expect(screen.getByText(`${KEY}.lead`)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Launch plan v2" }).getAttribute("href"),
    ).toBe("/doc-0");
    expect(screen.queryByText(`${KEY}.stale`)).toBeNull();
  });

  it("says when the target is no longer current, and never names a document the reader cannot open", () => {
    render(
      <DocumentReplaceIntent
        workspaceId="ws-1"
        targetId="doc-0"
        title={null}
        stale
      />,
    );
    expect(screen.getByText(`${KEY}.hidden`)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(`${KEY}.stale`)).toBeTruthy();
  });
});
