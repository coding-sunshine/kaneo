import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { InboxDocumentQuestions } from "./inbox-document-questions";

const mocks = vi.hoisted(() => ({
  receipt: vi.fn(),
  topic: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/topic/use-facts", () => ({
  useDocumentReceipt: mocks.receipt,
}));
vi.mock("@/hooks/queries/topic/use-topics", () => ({
  useTopic: mocks.topic,
}));
vi.mock("@/components/documents/fact-conflict-card", () => ({
  FactConflictCard: (props: {
    conflict: { slotName: string };
    canDecide: boolean;
    deciderName: string | null;
  }) => (
    <p>
      {props.conflict.slotName} decide:{String(props.canDecide)}{" "}
      {props.deciderName}
    </p>
  ),
}));

const doc = { workspaceId: "ws-1", id: "doc-1", topicId: "topic-1" };
const conflict = (slotName: string, status: string) => ({
  id: slotName,
  slotName,
  status,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InboxDocumentQuestions", () => {
  it("shows the open conflicts of the document to the topic's decider", () => {
    mocks.topic.mockReturnValue({
      data: { canDecide: true, deciderName: "Mina" },
    });
    mocks.receipt.mockReturnValue({
      data: {
        conflicts: [
          conflict("Launch date", "open"),
          conflict("Price", "resolved"),
        ],
      },
    });
    render(<InboxDocumentQuestions document={doc} />);

    expect(
      screen.getByText("navigation:documents.facts.conflict.open"),
    ).toBeTruthy();
    expect(screen.getByText("Launch date decide:true Mina")).toBeTruthy();
    expect(screen.queryByText(/Price/)).toBeNull();
    expect(mocks.receipt).toHaveBeenCalledWith("ws-1", "doc-1");
  });

  it("shows nothing when no conflict is open, or the document is on no topic", () => {
    mocks.topic.mockReturnValue({ data: undefined });
    mocks.receipt.mockReturnValue({
      data: { conflicts: [conflict("Price", "tolerated")] },
    });
    const { container, rerender } = render(
      <InboxDocumentQuestions document={doc} />,
    );
    expect(container.firstChild).toBeNull();

    mocks.receipt.mockReturnValue({ data: undefined });
    rerender(<InboxDocumentQuestions document={{ ...doc, topicId: null }} />);
    expect(container.firstChild).toBeNull();
    expect(mocks.receipt).toHaveBeenLastCalledWith("ws-1", null);
  });
});
