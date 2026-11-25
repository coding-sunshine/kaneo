import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentsEmpty } from "./documents-empty";

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
    ...rest
  }: {
    children?: ReactNode;
    params: { tab: string };
  }) => (
    <a href={`/documents/${params.tab}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("./documents-illustration", () => ({
  DocumentsIllustration: () => null,
}));

const DOCS = "navigation:documents";
const show = (filter: "shared" | "inbox" | "mine") =>
  render(
    <DocumentsEmpty
      workspaceId="w1"
      filter={filter}
      onCreate={() => {}}
      creating={false}
    />,
  );

afterEach(cleanup);

describe("DocumentsEmpty", () => {
  it("sends Shared with me to My documents", () => {
    show("shared");
    const link = screen.getByText(
      `${DOCS}.empty.openTab {"tab":"${DOCS}.tabs.mine"}`,
    );
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "/documents/my-documents",
    );
  });

  it("sends the Inbox to Not yet filed", () => {
    show("inbox");
    const link = screen.getByText(
      `${DOCS}.empty.openTab {"tab":"${DOCS}.tabs.unfiled"}`,
    );
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "/documents/not-yet-filed",
    );
  });

  it("keeps the New document button on My documents", () => {
    show("mine");
    expect(screen.getByText(`${DOCS}.newDocument`)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
