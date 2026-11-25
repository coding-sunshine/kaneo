import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentSharePopover } from "./document-share-popover";

const mocks = vi.hoisted(() => ({
  unshare: vi.fn(),
  share: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  members: [] as unknown[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: mocks.success },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { name: "Acme" } }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: mocks.members } }),
  }),
);
vi.mock("@/hooks/mutations/document/use-document-mutations", () => ({
  useShareDocument: () => ({ mutate: mocks.share }),
  useUpdateDocument: () => ({ mutate: mocks.update }),
  useUnshareDocumentFromTask: () => ({ mutate: mocks.unshare }),
}));
vi.mock("./document-who-can-open", () => ({
  DocumentWhoCanOpen: () => <p>who can open: 2 people, Ana Lima, Ben Ode</p>,
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

describe("DocumentSharePopover messages", () => {
  it("puts who can open it before people with access", () => {
    show("view");
    const who = screen.getByText(/who can open: 2 people, Ana Lima, Ben Ode/);
    const people = screen.getByText(
      "navigation:documents.share.peopleWithAccess",
    );
    expect(
      who.compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("says when general access changed", () => {
    mocks.update.mockImplementation((_vars, options) => options.onSuccess());
    show("owner");
    fireEvent.click(screen.getByText("navigation:documents.share.access.view"));
    fireEvent.click(
      screen.getByText("navigation:documents.share.access.comment"),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      "navigation:documents.share.updated",
    );
  });

  it("says who was added", () => {
    mocks.members = [{ userId: "u9", user: { name: "Cy Park", image: null } }];
    mocks.share.mockImplementation((_vars, options) => options.onSuccess());
    show("owner");
    fireEvent.click(
      screen.getByLabelText("navigation:documents.share.addPeople"),
    );
    fireEvent.click(screen.getByText("Cy Park"));
    expect(mocks.success).toHaveBeenCalledWith(
      'navigation:documents.share.added {"name":"Cy Park"}',
    );
    mocks.members = [];
  });
});
