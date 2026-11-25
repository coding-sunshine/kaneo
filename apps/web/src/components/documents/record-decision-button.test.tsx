import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Topic } from "@/fetchers/topic/topics";
import { toast } from "@/lib/toast";
import { RecordDecisionButton } from "./record-decision-button";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/mutations/topic/use-topic-mutations", () => ({
  useRecordTopicDecision: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("./make-current-dialog", () => ({
  MakeCurrentDialog: ({
    document,
    initialReason,
  }: {
    document: { id: string };
    initialReason?: string;
  }) => (
    <p>
      approval {document.id} / {initialReason}
    </p>
  ),
}));

const NS = "navigation:documents.decision";
const topic = (over: Partial<Topic> = {}) =>
  ({
    id: "topic-1",
    workspaceId: "ws-1",
    name: "Launch date",
    currentDocumentId: null,
    canDecide: true,
    ...over,
  }) as Topic;

const open = (over: Partial<Topic> = {}) => {
  render(<RecordDecisionButton topic={topic(over)} />);
  fireEvent.click(screen.getByRole("button", { name: `${NS}.action` }));
};
const fill = (text: string, reason: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: `${NS}.textLabel` }), {
    target: { value: text },
  });
  fireEvent.change(screen.getByRole("textbox", { name: `${NS}.reasonLabel` }), {
    target: { value: reason },
  });
};
const record = () =>
  screen.getByRole("button", { name: `${NS}.submit` }) as HTMLButtonElement;
const succeed = (document: object) =>
  mocks.mutate.mockImplementation((_input, options) =>
    options.onSuccess(document),
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecordDecisionButton", () => {
  it("renders nothing for someone who does not decide", () => {
    const { container } = render(
      <RecordDecisionButton topic={topic({ canDecide: false })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("keeps Record disabled until both boxes have text", () => {
    open();
    expect(record().disabled).toBe(true);
    fill("Ship on Friday", "   ");
    expect(record().disabled).toBe(true);
    fill("Ship on Friday", "Sales is ready");
    expect(record().disabled).toBe(false);
  });

  it("starts a document, then says so and closes", async () => {
    succeed({
      id: "doc-1",
      status: "current",
      contentHash: "a",
      approvedHash: "a",
    });
    open();
    fill("  Ship on Friday  ", "  Sales is ready  ");
    fireEvent.click(record());

    expect(mocks.mutate).toHaveBeenCalledWith(
      {
        id: "topic-1",
        text: "Ship on Friday",
        reason: "Sales is ready",
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
      expect.any(Object),
    );
    expect(toast.success).toHaveBeenCalledWith(`${NS}.done`);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("hands an edited current document to the approval step", () => {
    succeed({
      id: "doc-1",
      status: "current",
      contentHash: "b",
      approvedHash: "a",
    });
    open({ currentDocumentId: "doc-1" });
    fill("Ship on Friday", "  Sales is ready ");
    fireEvent.click(record());

    expect(screen.getByText("approval doc-1 / Sales is ready")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the dialog open", () => {
    mocks.mutate.mockImplementation((_input, options) =>
      options.onError(new Error("Not allowed")),
    );
    open();
    fill("Ship on Friday", "Sales is ready");
    fireEvent.click(record());

    expect(toast.error).toHaveBeenCalledWith("Not allowed");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("describes adding to a current document, or starting one", () => {
    open({ currentDocumentId: "doc-1" });
    expect(
      screen.getByText(`${NS}.hintAdd {"topic":"Launch date"}`),
    ).toBeTruthy();
    cleanup();
    open();
    expect(
      screen.getByText(`${NS}.hintStart {"topic":"Launch date"}`),
    ).toBeTruthy();
  });
});
