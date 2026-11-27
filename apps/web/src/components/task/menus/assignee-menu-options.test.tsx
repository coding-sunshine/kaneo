import { describe, expect, it } from "vite-plus/test";
import { assigneeMenuOptions } from "./assignee-menu-options";

const members = [{ id: "user-1", name: "John Doe", email: null, image: null }];

function selectedValues(current: string | null | undefined) {
  return assigneeMenuOptions(members, current, "Unassigned")
    .filter((option) => option.selected)
    .map((option) => option.value);
}

describe("assigneeMenuOptions", () => {
  it("lists unassigned first, then members", () => {
    expect(
      assigneeMenuOptions(members, null, "Unassigned").map(
        (option) => option.label,
      ),
    ).toEqual(["Unassigned", "John Doe"]);
  });

  it("marks unassigned when nobody is assigned", () => {
    expect(selectedValues(null)).toEqual([""]);
  });

  it("marks the assigned member", () => {
    expect(selectedValues("user-1")).toEqual(["user-1"]);
  });

  it("marks nothing when the selection is mixed", () => {
    expect(selectedValues(undefined)).toEqual([]);
  });

  it("shows a member's status and out-of-office next to their name", () => {
    const [, option] = assigneeMenuOptions(
      [
        {
          ...members[0],
          profile: {
            status: { text: "In a meeting", clearsAt: null },
            outOfOffice: {
              from: "2026-11-30T00:00:00Z",
              until: "2026-12-04T23:59:59Z",
            },
          },
        },
      ],
      null,
      "Unassigned",
      "Out of office",
    );
    expect(option?.hint).toBe("In a meeting · Out of office");
  });
});
