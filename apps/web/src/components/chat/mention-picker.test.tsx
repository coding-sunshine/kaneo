import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MentionPicker } from "./mention-picker";

const state = vi.hoisted(() => ({
  all: [
    {
      type: "task",
      id: "t1",
      title: "Fix checkout",
      projectSlug: "eng",
      taskNumber: 4,
    },
    { type: "document", id: "d1", title: "Spec" },
    { type: "project", id: "p1", title: "Project X" },
    { type: "comment", id: "c1", title: "a comment" },
    { type: "person", id: "u2", userId: "u2", title: "User B" },
  ],
  people: [{ type: "person", id: "u2", userId: "u2", title: "User B" }],
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: ({ type }: { type: string }) => ({
    data: { results: type === "people" ? state.people : state.all },
    isFetching: false,
  }),
}));

describe("MentionPicker", () => {
  afterEach(cleanup);

  it("offers people, tickets, documents and teams, and writes the picked one", () => {
    const onPick = vi.fn();
    render(<MentionPicker workspaceId="w1" onPick={onPick} />);
    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.mention" }),
    );
    fireEvent.change(screen.getByLabelText("navigation:chat.mentionSearch"), {
      target: { value: "x" },
    });

    expect(screen.queryByText("a comment")).toBeNull();
    fireEvent.click(screen.getByText("User B"));
    expect(onPick).toHaveBeenLastCalledWith(
      '<kaneo-mention id="u2"></kaneo-mention>',
    );

    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.mention" }),
    );
    fireEvent.change(screen.getByLabelText("navigation:chat.mentionSearch"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByText("Fix checkout"));
    expect(onPick).toHaveBeenLastCalledWith("ENG-4");

    fireEvent.click(
      screen.getByRole("button", { name: "navigation:chat.mention" }),
    );
    fireEvent.change(screen.getByLabelText("navigation:chat.mentionSearch"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByText("Project X"));
    expect(onPick).toHaveBeenLastCalledWith(
      `${window.location.origin}/dashboard/workspace/w1/project/p1/board`,
    );
  });
});
