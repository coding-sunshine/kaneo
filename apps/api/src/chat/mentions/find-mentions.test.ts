import { describe, expect, it } from "vite-plus/test";
import { findMentions, taskRef } from "./find-mentions";

describe("findMentions", () => {
  it("finds people, typed keys and this workspace's addresses", () => {
    const found = findMentions(
      '<kaneo-mention id="u1"></kaneo-mention> see eng-12 and https://x.example/dashboard/workspace/w1/document/d1 and https://x.example/dashboard/workspace/w1/project/p1/board and https://x.example/dashboard/workspace/w2/project/p2',
      "w1",
    );
    expect(found).toEqual({
      userIds: ["u1"],
      taskKeys: [{ key: "eng", number: 12 }],
      documentIds: ["d1"],
      projectIds: ["p1"],
    });
  });

  it("writes a key the same way however it was typed", () => {
    expect(taskRef("eng", 12)).toBe("ENG-12");
  });
});
