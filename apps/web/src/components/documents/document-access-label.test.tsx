import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  DocumentDetail,
  DocumentSummary,
} from "@/fetchers/document/documents";
import { DocumentAccessLabel } from "./document-access-label";
import { DocumentCrumbs } from "./document-crumbs";
import { DocumentList } from "./document-list";

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
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/common/favorite-star", () => ({
  FavoriteStar: () => null,
}));
vi.mock("./document-options-menu", () => ({ DocumentOptionsMenu: () => null }));
vi.mock("./document-parent-link", () => ({ DocumentParentLink: () => null }));

const LABEL = "navigation:documents.accessLabel";

afterEach(cleanup);

describe("DocumentAccessLabel", () => {
  it.each(["private", "workspace"] as const)(
    "shows its own word for %s, with an aria-hidden icon and the hint",
    (scope) => {
      const { container } = render(
        <DocumentAccessLabel scope={scope} parentName="Alpha" />,
      );
      const label = screen.getByText(`${LABEL}.${scope}`);
      expect(label).toBeTruthy();
      expect(container.querySelector("svg[aria-hidden]")).toBeTruthy();
      expect(container.firstElementChild?.getAttribute("title")).toBe(
        `${LABEL}.hint.${scope}`,
      );
      expect(screen.queryByText("Alpha")).toBeNull();
    },
  );

  it("shows the team name with the kind for screen readers", () => {
    render(<DocumentAccessLabel scope="team" parentName="Alpha" />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText(`${LABEL}.team:`).className).toContain("sr-only");
  });

  it.each(["team", "project", "issue"] as const)(
    "shows the kind word for %s without a parent name",
    (scope) => {
      render(<DocumentAccessLabel scope={scope} parentName={null} />);
      expect(screen.getByText(`${LABEL}.${scope}`)).toBeTruthy();
    },
  );
});

describe("DocumentList", () => {
  it("shows a label on every row", () => {
    const documents = [
      {
        id: "d1",
        title: "Launch plan",
        status: "draft",
        scope: "private",
        parentName: null,
        creatorName: "Ana Lima",
        creatorImage: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "d2",
        title: "Launch notes",
        status: "draft",
        scope: "team",
        parentName: "Alpha",
        creatorName: "Ben Ode",
        creatorImage: null,
        updatedAt: new Date().toISOString(),
      },
    ] as unknown as DocumentSummary[];
    render(<DocumentList workspaceId="w1" documents={documents} />);
    expect(screen.getByText(`${LABEL}.private`)).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();
  });
});

describe("DocumentCrumbs", () => {
  it("shows the label beside the title", () => {
    render(
      <DocumentCrumbs
        document={
          {
            id: "d1",
            workspaceId: "w1",
            title: "Launch plan",
            scope: "workspace",
            parentName: null,
          } as unknown as DocumentDetail
        }
        historyOpen={false}
        onRename={() => {}}
        onShare={() => {}}
        onToggleHistory={() => {}}
      />,
    );
    expect(screen.getByText("Launch plan")).toBeTruthy();
    expect(screen.getByText(`${LABEL}.workspace`)).toBeTruthy();
  });
});
