import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Reference } from "@/fetchers/reference/get-references";
import { MentionedIn } from "./mentioned-in";

const state = vi.hoisted(() => ({
  data: undefined as { references: Reference[] } | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params).reduce(
        (href, [name, value]) => href.replace(`$${name}`, value),
        to,
      )}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/reference/use-references", () => ({
  useReferences: () => ({ data: state.data }),
}));

const ticket = (id: string, key: string | null): Reference => ({
  kind: "task",
  id,
  title: `Ticket ${id}`,
  key,
  projectId: "team1",
  places: ["description"],
});
const doc: Reference = {
  kind: "document",
  id: "d1",
  title: "Release notes",
  key: null,
  projectId: null,
  places: ["document"],
};
const show = (references?: Reference[]) => {
  state.data = references && { references };
  return render(
    <MentionedIn workspaceId="ws" target={{ kind: "task", taskId: "t9" }} />,
  ).container;
};

afterEach(cleanup);

describe("MentionedIn", () => {
  it("shows nothing while loading, on error, or when nothing mentions the target", () => {
    expect(show(undefined).textContent).toBe("");
    expect(show([]).textContent).toBe("");
  });

  it("lists each ticket and document with a link that opens it", () => {
    show([ticket("t1", "ENG-12"), ticket("t2", null), doc]);

    expect(
      screen.getByRole("heading", { name: "common:mentionedIn.title" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /ENG-12/ }).getAttribute("href"),
    ).toBe("/dashboard/workspace/ws/project/team1/task/t1");
    expect(
      screen.getByRole("link", { name: "Ticket t2" }).getAttribute("href"),
    ).toBe("/dashboard/workspace/ws/project/team1/task/t2");
    expect(
      screen.getByRole("link", { name: /Release notes/ }).getAttribute("href"),
    ).toBe("/dashboard/workspace/ws/document/d1");
  });
});
