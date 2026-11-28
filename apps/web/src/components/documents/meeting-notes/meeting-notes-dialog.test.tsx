import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { MeetingNotesDialog } from "./meeting-notes-dialog";

const state = vi.hoisted(() => ({
  hasAgent: true,
  propose: vi.fn(),
  accept: vi.fn(),
  transcribe: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/task/header/header-icon-button", () => ({
  HeaderIconButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => state.hasAgent,
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [{ id: "p1", name: "Ops" }] }),
}));
vi.mock("@/fetchers/meeting-notes/meeting-notes", () => ({
  proposeMeetingNotes: (...args: unknown[]) => state.propose(...args),
  acceptMeetingNotes: (...args: unknown[]) => state.accept(...args),
  transcribeMeeting: (...args: unknown[]) => state.transcribe(...args),
}));

const TRANSCRIPT = "Sam: Let's ship on Friday. Riley: I will write the notes.";

const renderDialog = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MeetingNotesDialog workspaceId="ws1" documentId="d1" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByText("navigation:documents.meetingNotes.open"));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.hasAgent = true;
});

describe("MeetingNotesDialog", () => {
  it("does not keep the transcript unless asked, and shows quotes", async () => {
    state.propose.mockResolvedValue({
      runId: null,
      decisions: [{ text: "Ship Friday", quote: "Let's ship on Friday." }],
      actionItems: [
        {
          title: "Write the notes",
          description: "",
          quote: "I will write the notes.",
        },
      ],
    });
    renderDialog();
    fireEvent.change(
      screen.getByLabelText("navigation:documents.meetingNotes.transcript"),
      { target: { value: TRANSCRIPT } },
    );
    fireEvent.click(screen.getByText("navigation:documents.meetingNotes.run"));
    expect(await screen.findByText("Ship Friday")).toBeTruthy();
    expect(state.propose).toHaveBeenCalledWith("ws1", "d1", TRANSCRIPT, false);
    expect(screen.getByText("I will write the notes.")).toBeTruthy();
    expect(screen.getByText("Write the notes")).toBeTruthy();
  });

  it("says so when the server has no speech to text", async () => {
    state.transcribe.mockRejectedValue(new HttpError(404, "off"));
    renderDialog();
    fireEvent.change(
      screen.getByLabelText("navigation:documents.meetingNotes.audio"),
      { target: { files: [new File(["x"], "sync.m4a")] } },
    );
    await waitFor(() =>
      expect(
        screen.getByText("navigation:documents.meetingNotes.audioOff"),
      ).toBeTruthy(),
    );
  });

  it("says AI is off without a model", () => {
    state.hasAgent = false;
    renderDialog();
    expect(
      screen.getByText("navigation:documents.meetingNotes.off"),
    ).toBeTruthy();
    expect(state.propose).not.toHaveBeenCalled();
  });
});
