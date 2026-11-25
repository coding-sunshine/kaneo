import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentCitedBy } from "./document-cited-by";

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
    params: { projectId: string; taskId: string };
  }) => <a href={`/${params.projectId}/${params.taskId}`}>{children}</a>,
}));

const task = (id: string, number: number | null) => ({
  id,
  title: `Title of ${id}`,
  number,
  projectId: "p1",
  projectSlug: "eng",
});
const show = (citedBy: ReturnType<typeof task>[]) =>
  render(<DocumentCitedBy document={{ workspaceId: "ws", citedBy }} />)
    .container;

afterEach(cleanup);

describe("DocumentCitedBy", () => {
  it("says nothing when no issue links to the document", () => {
    expect(show([]).textContent).toBe("");
  });

  it("counts the issues and links each by its key", () => {
    const text = show([task("t1", 12), task("t2", null)]).textContent;
    expect(text).toContain('navigation:documents.citedBy {"count":2}');
    expect(
      screen.getByRole("link", { name: "ENG-12" }).getAttribute("href"),
    ).toBe("/p1/t1");
    expect(
      screen.getByRole("link", { name: "Title of t2" }).getAttribute("href"),
    ).toBe("/p1/t2");
  });
});
