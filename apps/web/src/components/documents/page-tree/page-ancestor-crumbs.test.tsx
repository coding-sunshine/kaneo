import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { PageAncestorCrumbs } from "./page-ancestor-crumbs";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

afterEach(cleanup);

describe("PageAncestorCrumbs", () => {
  it("links each page above, top first", () => {
    render(
      <PageAncestorCrumbs
        workspaceId="w1"
        ancestors={[
          { id: "a", title: "Handbook" },
          { id: "b", title: "" },
        ]}
      />,
    );
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(
      ["Handbook", "navigation:documents.untitled"],
    );
  });
});
