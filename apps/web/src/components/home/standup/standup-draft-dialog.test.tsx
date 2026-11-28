import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { StandupDraftDialog } from "./standup-draft-dialog";

const copyToClipboard = vi.fn();
const draftHook = vi.fn();

vi.mock("@/lib/copy-to-clipboard", () => ({
  copyToClipboard: (text: string) => copyToClipboard(text),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/standup/use-standup-draft", () => ({
  default: (...args: unknown[]) => draftHook(...args),
}));

const draft = {
  did: [{ id: "t1", ticket: "WEB-1", title: "Ship login", projectId: "p1" }],
  doing: [],
  blocked: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StandupDraftDialog", () => {
  it("loads only once opened, lets me edit, and copies only on Copy", async () => {
    draftHook.mockReturnValue({ data: draft, isLoading: false });
    render(<StandupDraftDialog workspaceId="ws1" />);
    expect(draftHook).toHaveBeenLastCalledWith("ws1", 1, false);

    fireEvent.click(screen.getByText("workspace:home.standup.open"));
    expect(draftHook).toHaveBeenLastCalledWith("ws1", 1, true);
    const box = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(box.value).toContain(
      `- WEB-1 Ship login (${window.location.origin}/dashboard/workspace/ws1/project/p1/task/t1)`,
    );

    fireEvent.change(box, { target: { value: "My own words" } });
    expect(copyToClipboard).not.toHaveBeenCalled();

    copyToClipboard.mockResolvedValue(true);
    fireEvent.click(screen.getByText("workspace:home.standup.copy"));
    await waitFor(() =>
      expect(copyToClipboard).toHaveBeenCalledWith("My own words"),
    );
  });

  it("switches to the weekly window", async () => {
    draftHook.mockReturnValue({ data: draft, isLoading: false });
    render(<StandupDraftDialog workspaceId="ws1" />);
    fireEvent.click(screen.getByText("workspace:home.standup.open"));
    fireEvent.click(await screen.findByText("workspace:home.standup.week"));
    expect(draftHook).toHaveBeenLastCalledWith("ws1", 7, true);
  });
});
