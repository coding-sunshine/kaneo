import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AddToTicketDialog } from "./add-to-ticket-dialog";

const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  results: [
    { type: "task", id: "t1", title: "Fix checkout", archivedAt: null },
    { type: "task", id: "t2", title: "Old one", archivedAt: "2026-01-01" },
  ],
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: () => ({ data: { results: state.results }, isFetching: false }),
}));
vi.mock("@/hooks/mutations/chat/use-add-message-to-ticket", () => ({
  useAddMessageToTicket: () => ({ mutate: state.mutate, isPending: false }),
}));

describe("AddToTicketDialog", () => {
  afterEach(cleanup);

  it("adds the message to the picked ticket and leaves archived ones out", async () => {
    const onOpenChange = vi.fn();
    render(
      <AddToTicketDialog
        open
        onOpenChange={onOpenChange}
        workspaceId="w1"
        channelId="c1"
        messageId="m1"
      />,
    );

    expect(screen.queryByText("Old one")).toBeNull();
    fireEvent.click(await screen.findByText("Fix checkout"));

    expect(state.mutate).toHaveBeenCalledWith(
      { messageId: "m1", taskId: "t1" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    state.mutate.mock.calls[0]?.[1].onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
