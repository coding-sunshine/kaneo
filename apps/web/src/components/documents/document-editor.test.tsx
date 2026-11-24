import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { DocumentEditor } from "./document-editor";

const mocks = vi.hoisted(() => ({ updateDocument: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  updateDocument: mocks.updateDocument,
}));
// The real editor is covered by its own tests; this stub keeps the save logic
// in view: it renders the hydrated value once and reports typing.
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="body"
      defaultValue={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

const base: DocumentDetail = {
  id: "doc-1",
  workspaceId: "ws-1",
  title: "Plan",
  content: "Body",
  contentHash: "",
  kind: "unsorted",
  status: "draft",
  sourceClient: null,
  topicId: null,
  topicName: null,
  supersedesDocumentId: null,
  filedAt: null,
  statusReason: null,
  approvedById: null,
  approvedByName: null,
  approvedAt: null,
  approvedHash: null,
  approvedVersionId: null,
  confirmedAt: null,
  icon: null,
  color: null,
  scope: "workspace",
  projectId: null,
  workProjectId: null,
  taskId: null,
  parentName: null,
  creatorId: "u-1",
  creatorName: "Ada",
  creatorImage: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  generalAccess: "edit",
  updatedById: "u-1",
  updatedByName: "Ada",
  role: "owner",
  shares: [],
  subscriberIds: [],
};

const client = new QueryClient();
const renderEditor = (document: DocumentDetail, readOnly = false) =>
  render(
    <QueryClientProvider client={client}>
      <DocumentEditor document={document} readOnly={readOnly} />
    </QueryClientProvider>,
  );
const title = () =>
  screen.getByLabelText<HTMLTextAreaElement>(
    "navigation:documents.titlePlaceholder",
  );
const settle = () => act(() => vi.advanceTimersByTimeAsync(2000));

describe("DocumentEditor autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.updateDocument.mockReset();
    mocks.updateDocument.mockImplementation(
      async (_ws: string, _id: string, json: Partial<DocumentDetail>) => ({
        ...base,
        ...json,
      }),
    );
  });
  afterEach(() => {
    cleanup();
    descriptionSaveQueue.clear();
    vi.useRealTimers();
  });

  it("does not save when a document is only opened", async () => {
    renderEditor(base);
    await settle();
    expect(mocks.updateDocument).not.toHaveBeenCalled();
  });

  it("saves one PATCH per edited field", async () => {
    renderEditor(base);
    fireEvent.change(title(), { target: { value: "Pla" } });
    fireEvent.change(title(), { target: { value: "Plan B" } });
    fireEvent.change(screen.getByLabelText("body"), {
      target: { value: "New body" },
    });
    await settle();
    expect(mocks.updateDocument.mock.calls).toEqual([
      ["ws-1", "doc-1", { title: "Plan B" }],
      ["ws-1", "doc-1", { content: "New body" }],
    ]);
  });

  it("keeps local typing when the document refetches", async () => {
    const { rerender } = renderEditor(base);
    fireEvent.change(title(), { target: { value: "Mine" } });
    rerender(
      <QueryClientProvider client={client}>
        <DocumentEditor
          document={{ ...base, title: "Theirs", content: "Theirs" }}
          readOnly={false}
        />
      </QueryClientProvider>,
    );
    expect(title().value).toBe("Mine");
    await settle();
    expect(mocks.updateDocument.mock.calls).toEqual([
      ["ws-1", "doc-1", { title: "Mine" }],
    ]);
  });

  it("reopens with an edit that has not saved yet", () => {
    const first = renderEditor(base);
    fireEvent.change(title(), { target: { value: "Unsaved" } });
    first.unmount();
    renderEditor(base);
    expect(title().value).toBe("Unsaved");
  });

  it("never saves for viewers", async () => {
    renderEditor({ ...base, role: "view" }, true);
    expect(title().readOnly).toBe(true);
    fireEvent.change(title(), { target: { value: "Nope" } });
    fireEvent.change(screen.getByLabelText("body"), {
      target: { value: "Nope" },
    });
    await settle();
    expect(mocks.updateDocument).not.toHaveBeenCalled();
    expect(screen.getByText("navigation:documents.viewOnly")).toBeTruthy();
  });
});
