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
import { HttpError } from "@/lib/http-error";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { DocumentEditor } from "./document-editor";

const mocks = vi.hoisted(() => ({
  updateDocument: vi.fn(),
  getDocument: vi.fn(),
  announceDocumentEditing: vi.fn(),
  saveCoeditedText: vi.fn(),
  config: { documentCoediting: false },
  collabProps: { current: null as null | Record<string, unknown> },
  uploadDocumentFile: vi.fn(),
  editorProps: {
    current: {} as { uploadAsset?: (file: File) => Promise<unknown> },
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/document/documents", () => ({
  updateDocument: mocks.updateDocument,
  getDocument: mocks.getDocument,
}));
vi.mock("@/fetchers/document/editing", () => ({
  announceDocumentEditing: mocks.announceDocumentEditing,
}));
vi.mock("@/fetchers/document/collab", () => ({
  saveCoeditedText: mocks.saveCoeditedText,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: mocks.config }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "u-1", name: "Ada" } }),
}));
// The live body is covered by the collab tests; this stub reports typing and
// changes that other people made.
vi.mock("./collab/document-collab-body", () => ({
  DocumentCollabBody: (props: {
    generation: number;
    onChange?: (value: string, change: { remote: boolean }) => void;
  }) => {
    mocks.collabProps.current = props;
    return (
      <textarea
        aria-label="live body"
        data-generation={props.generation}
        onChange={(event) =>
          props.onChange?.(event.target.value, { remote: false })
        }
      />
    );
  },
}));
vi.mock("@/lib/upload-document-file", () => ({
  uploadDocumentFile: mocks.uploadDocumentFile,
}));
// The real editor is covered by its own tests; this stub keeps the save logic
// in view: it renders the hydrated value once and reports typing.
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({
    value,
    onChange,
    readOnly,
    uploadAsset,
  }: {
    value: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
    uploadAsset?: (file: File) => Promise<unknown>;
  }) => {
    mocks.editorProps.current = { uploadAsset };
    return (
      <textarea
        key={value}
        aria-label="body"
        defaultValue={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
    );
  },
}));

const base: DocumentDetail = {
  id: "doc-1",
  workspaceId: "ws-1",
  title: "Plan",
  content: "Body",
  contentHash: "h-open",
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
  revisionOf: null,
  citedBy: [],
  sharedTasks: [],
  hiddenSharedTaskCount: 0,
  shares: [],
  subscriberIds: [],
  ancestors: [],
  hasChildren: false,
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
    mocks.announceDocumentEditing.mockReset();
    mocks.announceDocumentEditing.mockResolvedValue({ announced: true });
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
      ["ws-1", "doc-1", { content: "New body", baseHash: "h-open" }],
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

const body = () => screen.getByLabelText<HTMLTextAreaElement>("body");
const type = (value: string) => fireEvent.change(body(), { target: { value } });
const changed = () =>
  new HttpError(409, "changed", { code: "DOCUMENT_CHANGED" });
const theirs = {
  ...base,
  content: "Their text",
  contentHash: "h-theirs",
  updatedById: "u-2",
  updatedByName: "Grace",
};

describe("DocumentEditor edit safety", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.updateDocument.mockReset();
    mocks.getDocument.mockReset();
    mocks.announceDocumentEditing.mockReset();
    mocks.announceDocumentEditing.mockResolvedValue({ announced: true });
  });
  afterEach(() => {
    cleanup();
    descriptionSaveQueue.clear();
    vi.useRealTimers();
  });

  it("saves on top of the text it opened, then on top of its own save", async () => {
    mocks.updateDocument.mockImplementation(
      async (_ws: string, _id: string, json: { content?: string }) => ({
        ...base,
        ...json,
        contentHash: `h-${json.content}`,
      }),
    );
    const { rerender } = renderEditor(base);
    type("One");
    await settle();
    // A refetch brings in someone else's hash; the editor still holds its own.
    rerender(
      <QueryClientProvider client={client}>
        <DocumentEditor document={theirs} readOnly={false} />
      </QueryClientProvider>,
    );
    type("Two");
    await settle();
    expect(mocks.updateDocument.mock.calls).toEqual([
      ["ws-1", "doc-1", { content: "One", baseHash: "h-open" }],
      ["ws-1", "doc-1", { content: "Two", baseHash: "h-One" }],
    ]);
  });

  it("warns who changed the text, keeps the typing, and saves only after review", async () => {
    mocks.updateDocument.mockRejectedValueOnce(changed());
    mocks.getDocument.mockResolvedValue(theirs);
    renderEditor(base);
    type("My text");
    await settle();

    expect(screen.getByRole("alert").textContent).toContain(
      "navigation:documents.conflict.banner",
    );
    expect(body().value).toBe("My text");
    // More typing while warned does not try to save over their text.
    type("My text, longer");
    await settle();
    expect(mocks.updateDocument).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.review",
      }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Their text");
    expect(dialog.textContent).toContain("My text, longer");

    mocks.updateDocument.mockResolvedValue({
      ...theirs,
      content: "My text, longer",
      contentHash: "h-mine",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.keepMine",
      }),
    );
    await settle();
    expect(mocks.updateDocument).toHaveBeenLastCalledWith("ws-1", "doc-1", {
      content: "My text, longer",
      baseHash: "h-theirs",
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("takes their text and drops the unsaved edit", async () => {
    mocks.updateDocument.mockRejectedValueOnce(changed());
    mocks.getDocument.mockResolvedValue(theirs);
    renderEditor(base);
    type("My text");
    await settle();

    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.review",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.useTheirs",
      }),
    );
    await settle();
    expect(body().value).toBe("Their text");
    expect(mocks.updateDocument).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();

    mocks.updateDocument.mockResolvedValue({
      ...theirs,
      contentHash: "h-next",
    });
    type("Their text, and more");
    await settle();
    expect(mocks.updateDocument).toHaveBeenLastCalledWith("ws-1", "doc-1", {
      content: "Their text, and more",
      baseHash: "h-theirs",
    });
  });

  it("tells the other readers while typing, once per few seconds", async () => {
    mocks.updateDocument.mockImplementation(async () => base);
    renderEditor(base);
    type("a");
    type("ab");
    fireEvent.change(title(), { target: { value: "Plan!" } });
    expect(mocks.announceDocumentEditing).toHaveBeenCalledTimes(1);
    expect(mocks.announceDocumentEditing).toHaveBeenCalledWith("ws-1", "doc-1");
    await act(() => vi.advanceTimersByTimeAsync(6000));
    type("abc");
    expect(mocks.announceDocumentEditing).toHaveBeenCalledTimes(2);
  });

  it("never announces for viewers", () => {
    renderEditor({ ...base, role: "view" }, true);
    type("x");
    expect(mocks.announceDocumentEditing).not.toHaveBeenCalled();
  });
});

describe("DocumentEditor while co-editing is on", () => {
  const live = () => screen.getByLabelText<HTMLTextAreaElement>("live body");
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.config.documentCoediting = true;
    mocks.saveCoeditedText.mockReset();
    mocks.updateDocument.mockReset();
    mocks.getDocument.mockReset();
    mocks.announceDocumentEditing.mockReset();
    mocks.announceDocumentEditing.mockResolvedValue({ announced: true });
  });
  afterEach(() => {
    cleanup();
    descriptionSaveQueue.clear();
    mocks.config.documentCoediting = false;
    vi.useRealTimers();
  });

  it("saves the merged text without a base, and announces only typing", async () => {
    mocks.saveCoeditedText.mockResolvedValue({ ...base, contentHash: "h-2" });
    renderEditor(base);
    const onChange = mocks.collabProps.current?.onChange as (
      value: string,
      change: { remote: boolean },
    ) => void;
    act(() => onChange("Grace typed this", { remote: true }));
    expect(mocks.announceDocumentEditing).not.toHaveBeenCalled();
    await settle();
    fireEvent.change(live(), {
      target: { value: "Grace typed this, Ada too" },
    });
    expect(mocks.announceDocumentEditing).toHaveBeenCalledTimes(1);
    await settle();
    expect(mocks.updateDocument).not.toHaveBeenCalled();
    expect(mocks.saveCoeditedText.mock.calls).toEqual([
      ["ws-1", "doc-1", { content: "Grace typed this" }],
      ["ws-1", "doc-1", { content: "Grace typed this, Ada too" }],
    ]);
  });

  it("keeps a viewer on the plain read-only body", () => {
    renderEditor({ ...base, role: "view" }, true);
    expect(screen.queryByLabelText("live body")).toBeNull();
    expect(body().readOnly).toBe(true);
  });

  it("after an outside change, saves over it only on purpose, or starts over from it", async () => {
    mocks.saveCoeditedText.mockRejectedValueOnce(changed());
    mocks.getDocument.mockResolvedValue(theirs);
    renderEditor(base);
    fireEvent.change(live(), { target: { value: "Ours" } });
    await settle();
    expect(screen.getByRole("alert").textContent).toContain(
      "navigation:documents.conflict.banner",
    );

    mocks.saveCoeditedText.mockResolvedValue({ ...base, contentHash: "h-3" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.review",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.keepMine",
      }),
    );
    await settle();
    expect(mocks.saveCoeditedText).toHaveBeenLastCalledWith("ws-1", "doc-1", {
      content: "Ours",
      baseHash: "h-theirs",
    });

    // A later save is an ordinary co-edited one again.
    fireEvent.change(live(), { target: { value: "Ours again" } });
    await settle();
    expect(mocks.saveCoeditedText).toHaveBeenLastCalledWith("ws-1", "doc-1", {
      content: "Ours again",
    });

    mocks.saveCoeditedText.mockRejectedValueOnce(changed());
    fireEvent.change(live(), { target: { value: "Ours, third" } });
    await settle();
    expect(live().dataset.generation).toBe("0");
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.review",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.conflict.useTheirs",
      }),
    );
    expect(live().dataset.generation).toBe("1");
  });
});

describe("DocumentEditor file upload", () => {
  const file = new File(["a"], "a.pdf");
  afterEach(cleanup);
  beforeEach(() => {
    mocks.uploadDocumentFile.mockReset();
  });

  it("offers uploads only when editable", () => {
    renderEditor(base);
    expect(mocks.editorProps.current.uploadAsset).toBeTypeOf("function");
    cleanup();
    renderEditor(base, true);
    expect(mocks.editorProps.current.uploadAsset).toBeUndefined();
  });

  it("uploads into this document", async () => {
    mocks.uploadDocumentFile.mockResolvedValue({ url: "u" });
    renderEditor(base);
    await mocks.editorProps.current.uploadAsset?.(file);
    expect(mocks.uploadDocumentFile).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      documentId: "doc-1",
      file,
    });
  });

  it("explains a refused file type", async () => {
    mocks.uploadDocumentFile.mockImplementation(async () => {
      throw new HttpError(415, "raw");
    });
    renderEditor(base);
    await expect(mocks.editorProps.current.uploadAsset?.(file)).rejects.toThrow(
      "navigation:documents.upload.typeNotAllowed",
    );
  });

  it("passes other errors through unchanged", async () => {
    const error = new HttpError(500, "boom");
    mocks.uploadDocumentFile.mockImplementation(async () => {
      throw error;
    });
    renderEditor(base);
    await expect(mocks.editorProps.current.uploadAsset?.(file)).rejects.toBe(
      error,
    );
  });
});
