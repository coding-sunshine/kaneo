import { describe, expect, it } from "vite-plus/test";
import { readSummary } from "./read-summary";

describe("readSummary", () => {
  const read = new Set(["c1", "c2"]);

  it("keeps only the comments the summary was given", () => {
    expect(
      readSummary(
        JSON.stringify({
          currentState: "Waiting on the API fix.",
          blockers: ["API returns 500"],
          comments: ["c2", "c9", "c2"],
        }),
        read,
      ),
    ).toEqual({
      currentState: "Waiting on the API fix.",
      blockers: ["API returns 500"],
      comments: ["c2"],
    });
  });

  it("reads JSON inside a code fence and defaults the lists", () => {
    expect(readSummary('```json\n{"currentState":"Done."}\n```', read)).toEqual(
      { currentState: "Done.", blockers: [], comments: [] },
    );
  });

  it("is null for an answer that is not a summary", () => {
    expect(readSummary("Here is a summary", read)).toBeNull();
    expect(readSummary('{"blockers":[]}', read)).toBeNull();
  });
});
