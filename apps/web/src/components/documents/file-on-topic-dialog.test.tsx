import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { FileOnTopicDialog } from "./file-on-topic-dialog";

const mocks = vi.hoisted(() => ({
  getTopics: vi.fn(),
  getDocumentAudience: vi.fn(),
  fileDocumentOnTopic: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/topic/topics", () => ({
  getTopics: mocks.getTopics,
  fileDocumentOnTopic: mocks.fileDocumentOnTopic,
}));
vi.mock("@/fetchers/document/documents", () => ({
  getDocumentAudience: mocks.getDocumentAudience,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const person = (name: string) => ({ userId: name, name, image: null });
const topics = [
  { id: "topic-ws", name: "Pricing", scope: "workspace", parentName: null },
  {
    id: "topic-team",
    name: "Launch plan",
    scope: "team",
    projectId: "team-1",
    parentName: "Growth",
  },
  {
    id: "topic-project",
    name: "Rollout",
    scope: "project",
    projectId: "team-1",
    workProjectId: "project-1",
    parentName: "Q4",
  },
];
const FILE = "navigation:documents.file";
const AUDIENCE = "navigation:documents.audience";

const show = (fromTopicId?: string) => {
  const onClose = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <FileOnTopicDialog
        document={{ workspaceId: "ws-1", id: "doc-1" }}
        fromTopicId={fromTopicId}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return onClose;
};
const submit = () =>
  screen.getByRole("button", { name: `${FILE}.submit` }) as HTMLButtonElement;
const choose = async (topicId: string) => {
  await screen.findByRole("option", { name: /Launch plan/ });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: topicId },
  });
};

describe("FileOnTopicDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("says who will be able to open the document before it files", async () => {
    mocks.getTopics.mockResolvedValue(topics);
    mocks.getDocumentAudience.mockResolvedValue({
      current: [person("Author"), person("Guest")],
      proposed: [person("Author"), person("Ana"), person("Ben")],
    });
    mocks.fileDocumentOnTopic.mockResolvedValue({});
    const onClose = show();

    // Nothing to file on yet, and nobody was asked about.
    expect(submit().disabled).toBe(true);
    await choose("topic-team");
    expect(mocks.getDocumentAudience).toHaveBeenCalledTimes(1);
    expect(mocks.getDocumentAudience).toHaveBeenCalledWith("ws-1", "doc-1", {
      projectId: "team-1",
    });

    expect(
      await screen.findByText(`${AUDIENCE}.count {"count":3}`),
    ).toBeTruthy();
    expect(screen.getByText("Author, Ana, Ben")).toBeTruthy();
    expect(
      screen.getByText(`${AUDIENCE}.gains {"names":"Ana, Ben"}`),
    ).toBeTruthy();
    expect(
      screen.getByText(`${AUDIENCE}.loses {"names":"Guest"}`),
    ).toBeTruthy();
    expect(mocks.fileDocumentOnTopic).not.toHaveBeenCalled();

    fireEvent.click(submit());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The query library hands a mutation its own second argument.
    expect(mocks.fileDocumentOnTopic.mock.calls[0]?.[0]).toEqual({
      workspaceId: "ws-1",
      id: "topic-team",
      documentId: "doc-1",
    });
  });

  it("asks about the place the chosen topic lives in", async () => {
    mocks.getTopics.mockResolvedValue(topics);
    mocks.getDocumentAudience.mockResolvedValue({
      current: [person("Author")],
      proposed: [person("Author")],
    });
    show();

    await choose("topic-project");
    await screen.findByText(`${AUDIENCE}.same`);
    expect(mocks.getDocumentAudience).toHaveBeenLastCalledWith(
      "ws-1",
      "doc-1",
      {
        workProjectId: "project-1",
      },
    );
    await choose("topic-ws");
    await waitFor(() =>
      expect(mocks.getDocumentAudience).toHaveBeenLastCalledWith(
        "ws-1",
        "doc-1",
        { scope: "workspace" },
      ),
    );
  });

  it("does not file when the audience cannot be read", async () => {
    mocks.getTopics.mockResolvedValue(topics);
    mocks.getDocumentAudience.mockRejectedValue(new Error("Forbidden"));
    show();

    await choose("topic-team");
    expect(await screen.findByText(`${AUDIENCE}.failed`)).toBeTruthy();
    expect(submit().disabled).toBe(true);
  });

  it("moves a proposal to another topic and never offers the one it is on", async () => {
    mocks.getTopics.mockResolvedValue(topics);
    mocks.getDocumentAudience.mockResolvedValue({
      current: [person("Author")],
      proposed: [person("Author")],
    });
    mocks.fileDocumentOnTopic.mockResolvedValue({});
    const onClose = show("topic-ws");

    expect(screen.getByText(`${FILE}.moveTitle`)).toBeTruthy();
    await screen.findByRole("option", { name: /Launch plan/ });
    expect(screen.queryByRole("option", { name: "Pricing" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "topic-team" },
    });
    await screen.findByText(`${AUDIENCE}.same`);
    fireEvent.click(screen.getByRole("button", { name: `${FILE}.moveSubmit` }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.fileDocumentOnTopic.mock.calls[0]?.[0]).toEqual({
      workspaceId: "ws-1",
      id: "topic-team",
      documentId: "doc-1",
    });
  });

  it("says so when there is no topic to file on", async () => {
    mocks.getTopics.mockResolvedValue([]);
    show();

    expect(await screen.findByText(`${FILE}.noTopics`)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(submit().disabled).toBe(true);
  });
});
