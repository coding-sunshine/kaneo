import { describe, expect, it } from "vite-plus/test";
import { formatStandup } from "./format-standup";

const labels = {
  did: "Did",
  doing: "Doing",
  blocked: "Blocked",
  none: "Nothing",
};
const item = (id: string, ticket: string, title: string) => ({
  id,
  ticket,
  title,
  projectId: "p1",
});

describe("formatStandup", () => {
  it("lists each ticket with its key, title and link under its section", () => {
    const text = formatStandup(
      {
        did: [item("t1", "WEB-1", "Ship login")],
        doing: [item("t2", "WEB-2", "Fix footer")],
        blocked: [],
      },
      labels,
      (task) => `https://kaneo.example/task/${task.id}`,
    );
    expect(text).toBe(
      [
        "Did",
        "- WEB-1 Ship login (https://kaneo.example/task/t1)",
        "",
        "Doing",
        "- WEB-2 Fix footer (https://kaneo.example/task/t2)",
        "",
        "Blocked",
        "- Nothing",
      ].join("\n"),
    );
  });
});
