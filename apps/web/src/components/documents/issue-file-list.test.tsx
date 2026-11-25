import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { IssueFile } from "@/fetchers/document/issue-files";
import { IssueFileList } from "./issue-file-list";

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
  }) => (
    <a href={`/${params.documentId ?? params.topicId ?? params.taskId}`}>
      {children}
    </a>
  ),
}));

const D = "navigation:documents.issueFiles";
const file = (topics: IssueFile["topics"]): IssueFile => ({
  id: "asset-1",
  filename: "plan.pdf",
  mimeType: "application/pdf",
  size: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  url: "https://files.test/plan.pdf",
  task: {
    id: "task-1",
    title: "Book the venue",
    number: 7,
    projectId: "p1",
    projectSlug: "grw",
  },
  topics,
});

const show = (files: IssueFile[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IssueFileList workspaceId="ws" files={files} />
    </QueryClientProvider>,
  );

describe("IssueFileList", () => {
  afterEach(cleanup);

  it("labels the file and names its issue", () => {
    show([file([])]);
    expect(screen.getByText(`${D}.badge`)).toBeTruthy();
    expect(screen.getByText("GRW-7")).toBeTruthy();
    expect(screen.getByText("Book the venue")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "plan.pdf" }).getAttribute("href"),
    ).toBe("https://files.test/plan.pdf");
  });

  it("offers a proposal per topic without one, and links one that exists", () => {
    show([
      file([
        { id: "t1", name: "Pricing", proposedDocumentId: null },
        { id: "t2", name: "Launch", proposedDocumentId: "doc-9" },
      ]),
    ]);
    expect(
      screen.getAllByRole("button", { name: `${D}.propose` }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: `${D}.proposed` }).getAttribute("href"),
    ).toBe("/doc-9");
  });

  it("says so when the issue is on no topic", () => {
    show([file([])]);
    expect(screen.getByText(`${D}.noTopic`)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
