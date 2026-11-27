import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskEmailReply } from "./task-email-reply";

const state = vi.hoisted(() => ({
  thread: null as {
    address: string;
    name: string | null;
    subject: string;
  } | null,
  reply: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));
vi.mock("@/hooks/queries/email-intake/use-ticket-email-thread", () => ({
  useTicketEmailThread: () => ({ data: state.thread }),
}));
vi.mock("@/fetchers/email-intake/reply-to-ticket-by-email", () => ({
  default: state.reply,
}));

function show() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TaskEmailReply taskId="task-1" />
    </QueryClientProvider>,
  );
}

describe("TaskEmailReply", () => {
  afterEach(() => {
    cleanup();
    state.reply.mockReset();
  });

  it("renders nothing for a ticket that did not come in by email", () => {
    state.thread = null;
    show();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("sends the reply to the requester", async () => {
    state.thread = {
      address: "sam@example.test",
      name: "Sam",
      subject: "Printer",
    };
    state.reply.mockResolvedValue({ to: "sam@example.test", commentId: "c1" });
    show();
    expect(
      screen.getByText("tasks:detail.emailReply.from Sam <sam@example.test>"),
    ).toBeTruthy();
    fireEvent.change(
      screen.getByLabelText("tasks:detail.emailReply.label sam@example.test"),
      { target: { value: " Unplug it. " } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:detail.emailReply.send" }),
    );
    await waitFor(() =>
      expect(state.reply).toHaveBeenCalledWith("task-1", "Unplug it."),
    );
  });
});
