import { expect, it } from "vite-plus/test";
import { getInitialTaskColumn } from "./initial-task-column";

it("never defaults new tasks to triage", () => {
  const columns = [
    { slug: "triage", isFinal: false },
    { slug: "backlog", isFinal: false },
    { slug: "done", isFinal: true },
  ];
  expect(getInitialTaskColumn(columns)?.slug).toBe("backlog");
  expect(getInitialTaskColumn(columns, "triage")?.slug).toBe("triage");
});
