import { createBaseExtensions } from "@kaneo/editor";
import { Editor } from "@tiptap/core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
import { toast } from "@/lib/toast";
import { addIssueLinks, checklistLines } from "./checklist-issues";
import { ChecklistToIssuesDialog } from "./checklist-to-issues-dialog";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  refetch: vi.fn(),
  audience: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "p1", name: "Alpha", slug: "alp" },
      { id: "p2", name: "Beta", slug: "bet" },
    ],
  }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ refetch: mocks.refetch }),
}));
vi.mock("@/hooks/queries/document/use-documents", () => ({
  useDocumentAudience: () => mocks.audience(),
}));
vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: mocks.create }),
}));
vi.mock("./checklist-issues", async (original) => {
  const actual = await original<typeof import("./checklist-issues")>();
  return { ...actual, addIssueLinks: vi.fn(actual.addIssueLinks) };
});

const taskUrl = (id: string) =>
  `${window.location.origin}/dashboard/workspace/ws/project/p1/task/${id}`;
const docUrl = `${window.location.origin}/dashboard/workspace/ws/document/d1`;

let editor: Editor | null = null;
const open = (markdown: string, at = 3) => {
  editor = new Editor({
    extensions: createBaseExtensions({ placeholder: "" }),
    content: markdown,
    contentType: "markdown",
  });
  editor.commands.setTextSelection(at);
  return editor;
};

afterEach(() => {
  cleanup();
  editor?.destroy();
  editor = null;
  vi.clearAllMocks();
});

type Item = {
  type: string;
  content?: Item[];
  text?: string;
  marks?: unknown[];
};
const taskItems = (node: Item): Item[] =>
  (node.content ?? []).flatMap((child) =>
    child.type === "taskItem" ? [child, ...taskItems(child)] : taskItems(child),
  );
const firstParagraph = (item: Item) => item.content?.[0]?.content ?? [];

describe("checklistLines", () => {
  it("gives the open lines around the selection, in order", () => {
    const ed = open(
      [
        "- [ ] Launch plan",
        "  - [ ] Book the venue",
        "  - [x] Done already",
        "- [ ] ",
        `- [ ] Linked [ALP-1](${taskUrl("t1")})`,
        "- [ ] Send invites",
        "",
        "Between the lists.",
        "",
        "- [ ] Other list",
      ].join("\n"),
    );
    expect(checklistLines(ed).map((line) => line.title)).toEqual([
      "Launch plan",
      "Book the venue",
      "Send invites",
    ]);
  });

  it("is empty outside a checklist", () => {
    const ed = open("Just a paragraph\n\n- [ ] Launch plan", 3);
    expect(checklistLines(ed)).toEqual([]);
  });
});

describe("addIssueLinks", () => {
  const markdown =
    "- [ ] Launch plan\n  - [ ] Book the venue\n- [ ] Send invites";

  it("ends each line with a link that survives Markdown", () => {
    const ed = open(markdown);
    const lines = checklistLines(ed);
    addIssueLinks(
      ed,
      lines.map((line, index) => ({
        ...line,
        key: `ALP-${index + 1}`,
        url: taskUrl(`t${index + 1}`),
      })),
    );
    const again = open(ed.getMarkdown());
    const items = taskItems(again.getJSON() as Item);
    expect(items).toHaveLength(3);
    for (const [index, item] of items.entries()) {
      const last = firstParagraph(item).at(-1);
      expect(last?.text).toBe(`ALP-${index + 1}`);
      expect(JSON.stringify(last?.marks)).toContain(taskUrl(`t${index + 1}`));
    }
    expect(checklistLines(again)).toEqual([]);
  });

  it("skips a line whose text changed since it was read", () => {
    const ed = open(markdown);
    const lines = checklistLines(ed);
    ed.commands.insertContentAt(lines[2].pos + 2, "Really ");
    addIssueLinks(
      ed,
      lines.map((line) => ({ ...line, key: "ALP-1", url: taskUrl("t1") })),
    );
    expect(ed.getText()).not.toContain("Really Send invites ALP-1");
    expect(ed.getText()).toContain("Launch plan ALP-1");
  });
});

describe("ChecklistToIssuesDialog", () => {
  const document = {
    workspaceId: "ws",
    id: "d1",
    projectId: "p1",
  } as unknown as DocumentDetail;
  const person = (userId: string) => ({ userId, name: userId });
  const answer = (proposed: string[], current = ["a"]) => ({
    data: {
      current: current.map(person),
      proposed: proposed.map(person),
    },
    isLoading: false,
    isError: false,
  });
  const show = (
    markdown = "- [ ] Launch plan\n- [ ] Book the venue\n- [ ] Send invites",
  ) => {
    const ed = open(markdown);
    render(
      <ChecklistToIssuesDialog
        document={document}
        editor={ed}
        lines={checklistLines(ed)}
        onClose={vi.fn()}
      />,
    );
    return ed;
  };
  const submit = () =>
    screen.getByRole("button", { name: /checklist\.submit/ });

  beforeEach(() => {
    mocks.audience.mockReturnValue(answer(["a"]));
    mocks.refetch.mockResolvedValue({
      isError: false,
      data: [{ slug: "backlog", isFinal: false }],
    });
    let made = 0;
    mocks.create.mockImplementation(async () => {
      made += 1;
      return { id: `t${made}`, number: made };
    });
  });

  it("lists the lines, chooses the document's team and shows no notice", () => {
    show();
    expect(screen.getByRole("checkbox", { name: "Launch plan" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Send invites" })).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          "navigation:documents.checklist.team",
        ) as HTMLSelectElement
      ).value,
    ).toBe("p1");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns how many people can open the issues but not the document", () => {
    mocks.audience.mockReturnValue(answer(["a", "b", "c"]));
    show();
    const notice = screen.getByRole("status");
    expect(notice.textContent).toContain(
      "navigation:documents.checklist.audience",
    );
    expect(notice.textContent).toContain('"count":2');
    expect(notice.textContent).toContain("Alpha");
  });

  it("keeps Create disabled until the audience arrives and when it fails", () => {
    mocks.audience.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    show();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    mocks.audience.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    show();
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("navigation:documents.checklist.audienceFailed"),
    ).toBeTruthy();
  });

  it("creates one issue per ticked line, in order, and links the lines", async () => {
    show();
    fireEvent.click(screen.getByRole("checkbox", { name: "Book the venue" }));
    fireEvent.click(submit());
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls.map(([input]) => input.title)).toEqual([
      "Launch plan",
      "Send invites",
    ]);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      description: docUrl,
      projectId: "p1",
      status: "backlog",
      priority: "no-priority",
    });
    const { addIssueLinks: spy } = await import("./checklist-issues");
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(vi.mocked(spy).mock.calls[0][1]).toMatchObject([
      { title: "Launch plan", key: "ALP-1", url: taskUrl("t1") },
      { title: "Send invites", key: "ALP-2", url: taskUrl("t2") },
    ]);
  });

  it("links the line that was made when a later one fails", async () => {
    let calls = 0;
    mocks.create.mockImplementation(async () => {
      calls += 1;
      if (calls === 2) throw new Error("boom");
      return { id: "t1", number: 1 };
    });
    const ed = show();
    fireEvent.click(submit());
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      'navigation:documents.checklist.partial {"done":1,"total":3}',
    );
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(ed.getText()).toContain("Launch plan ALP-1");
    expect(ed.getText()).not.toContain("Book the venue ALP");
  });
});
