import { describe, expect, it } from "vite-plus/test";
import type { ChatMention } from "./split-mentions";
import { splitMentions } from "./split-mentions";

const mention = (over: Partial<ChatMention>): ChatMention => ({
  kind: "task",
  ref: "",
  id: null,
  title: null,
  status: null,
  projectId: null,
  restricted: false,
  ...over,
});

describe("splitMentions", () => {
  it("turns each named thing the server resolved into a card", () => {
    const user = mention({ kind: "user", ref: "u1", id: "u1", title: "B" });
    const task = mention({ ref: "ENG-1", id: "t1", title: "Fix" });
    const doc = mention({
      kind: "document",
      ref: "d1",
      id: "d1",
      title: "Spec",
    });
    const team = mention({ kind: "project", ref: "p1", restricted: true });
    const parts = splitMentions(
      '<kaneo-mention id="u1"></kaneo-mention> see eng-1, https://x.example/dashboard/workspace/w1/document/d1 and https://x.example/dashboard/workspace/w1/project/p1.',
      [user, task, doc, team],
    );
    expect(parts).toEqual([
      { mention: user },
      { text: " see " },
      { mention: task },
      { text: ", " },
      { mention: doc },
      { text: " and " },
      { mention: team },
      { text: "." },
    ]);
  });

  it("leaves what the server did not resolve as text and links", () => {
    expect(splitMentions("ABC-2 at https://x.example/a", [])).toEqual([
      { text: "ABC-2" },
      { text: " at " },
      { text: "https://x.example/a", href: "https://x.example/a" },
    ]);
  });
});
