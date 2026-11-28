import { describe, expect, it } from "vite-plus/test";
import { mentionToken } from "./mention-token";
import { splitMentions } from "./split-mentions";

const origin = "https://app.example";

describe("mentionToken", () => {
  it("writes each pick in the form the server and the cards read", () => {
    expect(mentionToken({ type: "person", userId: "u1" }, "w1", origin)).toBe(
      '<kaneo-mention id="u1"></kaneo-mention>',
    );
    expect(
      mentionToken(
        { type: "task", projectSlug: "eng", taskNumber: 4 },
        "w1",
        origin,
      ),
    ).toBe("ENG-4");
    const document = mentionToken({ type: "document", id: "d1" }, "w1", origin);
    const team = mentionToken({ type: "project", id: "p1" }, "w1", origin);
    const card = (kind: "document" | "project", ref: string) => ({
      kind,
      ref,
      id: ref,
      title: "T",
      status: null,
      projectId: null,
      restricted: false,
    });
    expect(
      splitMentions(`${document} ${team}`, [
        card("document", "d1"),
        card("project", "p1"),
      ]),
    ).toEqual([
      { mention: card("document", "d1") },
      { text: " " },
      { mention: card("project", "p1") },
    ]);
  });
});
