import { describe, expect, it } from "vite-plus/test";
import { groupSearchResults } from "./group-search-results";

const result = (id: string, type: string) => ({ id, type });

describe("groupSearchResults", () => {
  it("groups results by type in a fixed order, keeping rank inside a group", () => {
    const groups = groupSearchResults([
      result("doc-1", "document"),
      result("task-1", "task"),
      result("person-1", "person"),
      result("message-1", "message"),
      result("task-2", "task"),
      result("project-1", "project"),
      result("message-2", "message"),
    ]);
    expect(groups.map((group) => group.type)).toEqual([
      "message",
      "task",
      "document",
      "project",
      "person",
    ]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "message-1",
      "message-2",
    ]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual([
      "task-1",
      "task-2",
    ]);
  });

  it("leaves out types with no results and keeps unknown types last", () => {
    const groups = groupSearchResults([
      result("x-1", "something-new"),
      result("comment-1", "comment"),
    ]);
    expect(groups.map((group) => group.type)).toEqual([
      "comment",
      "something-new",
    ]);
  });
});
