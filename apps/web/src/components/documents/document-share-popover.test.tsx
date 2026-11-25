import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentSharePopover } from "./document-share-popover";

const mocks = vi.hoisted(() => ({ unshare: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { name: "Acme" } }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);
vi.mock("@/hooks/mutations/document/use-document-mutations", () => ({
  useShareDocument: () => ({ mutate: vi.fn() }),
  useUpdateDocument: () => ({ mutate: vi.fn() }),
  useUnshareDocumentFromTask: () => ({ mutate: mocks.unshare }),
}));
vi.mock("./use-copy-document-link", () => ({
  useCopyDocumentLink: () => vi.fn(),
}));

const sharedTasks = [
  { id: "t1", title: "Fix it", number: 7, projectId: "p", projectSlug: "eng" },
  { id: "t2", title: null, number: null, projectId: null, projectSlug: null },
];
const show = (role: string) =>
  render(
    <DocumentSharePopover
      document={
        {
          workspaceId: "w1",
          id: "d1",
          role,
          creatorId: "u0",
          creatorName: "Ann",
          creatorImage: null,
          shares: [],
          scope: "workspace",
          generalAccess: "view",
          sharedTasks,
        } as unknown as DocumentDetail
      }
      open
      onOpenChange={() => {}}
    />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DocumentSharePopover shared issues", () => {
  it("lists each issue, hiding the title of one the viewer cannot open", () => {
    show("edit");
    expect(screen.getByText("ENG-7 Fix it")).toBeTruthy();
    expect(
      screen.getByText("navigation:documents.share.hiddenTask"),
    ).toBeTruthy();
  });

  it("removes a share by issue id", () => {
    show("owner");
    fireEvent.click(
      screen.getByLabelText(
        'navigation:documents.share.stopSharingWith {"issue":"ENG-7 Fix it"}',
      ),
    );
    expect(mocks.unshare).toHaveBeenCalledWith(
      { id: "d1", taskId: "t1" },
      expect.anything(),
    );
  });

  it("shows a viewer the rows and no remove button", () => {
    show("view");
    expect(screen.getByText("ENG-7 Fix it")).toBeTruthy();
    expect(screen.queryAllByLabelText(/stopSharingWith/)).toHaveLength(0);
  });
});
