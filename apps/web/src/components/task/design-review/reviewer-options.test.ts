import { describe, expect, it, vi } from "vite-plus/test";
import { reviewerOptions } from "./reviewer-options";

vi.mock("../menus/assignee-menu-options", () => ({
  assigneeMenuOptions: (members: Array<{ id: string; name: string }>) => [
    { value: "", label: "unassigned", selected: false },
    ...members.map((m) => ({ value: m.id, label: m.name, selected: false })),
  ],
}));

describe("reviewerOptions", () => {
  it("leaves out the caller and marks people already asked", () => {
    const options = reviewerOptions(
      [
        { id: "me", name: "Me" },
        { id: "u2", name: "Two" },
        { id: "u3", name: "Three" },
      ],
      "me",
      ["u3"],
    );
    expect(options.map((o) => [o.value, o.selected])).toEqual([
      ["u2", false],
      ["u3", true],
    ]);
  });
});
