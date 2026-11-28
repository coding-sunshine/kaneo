import { describe, expect, it } from "vite-plus/test";
import { DECISION_TOOL } from "../decision/decision-tool";
import { DELEGATE_TOOL } from "../delegation/delegate-tool";
import { DIGEST_TOOL } from "../digest/digest-tool";
import { buildAgentTools, CHAT_WRITE_TOOLS } from "../tools";
import { THREAD_TICKET_TOOL } from "../thread-ticket/thread-ticket-tool";
import { TRIAGE_TOOL } from "../triage/triage-tool";
import { fieldDiff, shownArguments, type TaskState } from "./field-diff";

const task: TaskState = {
  title: "Login fails",
  description: "Steps inside",
  status: "to-do",
  priority: "low",
  dueDate: null,
  startDate: null,
  userId: null,
  projectId: "p1",
  labels: ["ui"],
};

describe("fieldDiff", () => {
  it("lists priority and labels a change_task changes", () => {
    expect(
      fieldDiff(
        "change_task",
        {
          taskId: "t1",
          priority: "high",
          addLabels: ["bug", "ui"],
          removeLabels: [],
        },
        task,
      ),
    ).toEqual([
      { field: "priority", from: "low", to: "high" },
      { field: "labels", from: "ui", to: "bug, ui" },
    ]);
  });

  it("leaves out a field that would not change", () => {
    expect(
      fieldDiff("change_task", { taskId: "t1", priority: "low" }, task),
    ).toEqual([]);
    expect(
      fieldDiff(
        "change_task",
        { taskId: "t1", addLabels: ["ui"], removeLabels: ["missing"] },
        task,
      ),
    ).toEqual([]);
  });

  it("diffs status, assignee and full updates against the task", () => {
    expect(
      fieldDiff("update_task_status", { taskId: "t1", status: "done" }, task),
    ).toEqual([{ field: "status", from: "to-do", to: "done" }]);
    expect(
      fieldDiff("update_task_assignee", { taskId: "t1", userId: "u2" }, task),
    ).toEqual([{ field: "assignee", from: null, to: "u2" }]);
    expect(
      fieldDiff(
        "update_task",
        { taskId: "t1", title: "Login fails on Safari", description: null },
        task,
      ),
    ).toEqual([
      { field: "title", from: "Login fails", to: "Login fails on Safari" },
      { field: "description", from: "Steps inside", to: null },
    ]);
  });

  it("shows a new task or comment as fields set from nothing", () => {
    expect(
      fieldDiff(
        "create_task",
        {
          projectId: "p1",
          title: "New",
          description: "",
          priority: "medium",
          status: "to-do",
        },
        null,
      ),
    ).toEqual([
      { field: "team", from: null, to: "p1" },
      { field: "title", from: null, to: "New" },
      { field: "priority", from: null, to: "medium" },
      { field: "status", from: null, to: "to-do" },
    ]);
    expect(
      fieldDiff("create_task_comment", { taskId: "t1", content: "Hi" }, task),
    ).toEqual([{ field: "comment", from: null, to: "Hi" }]);
  });
});

describe("every write argument shows on the card", () => {
  it("leaves no argument of a chat write out of the diff", () => {
    const tools = buildAgentTools(
      { json: async <T>() => ({}) as T },
      CHAT_WRITE_TOOLS,
      async () => "",
    );
    // Triage, delegation, thread tickets, decisions and the digest draft build their own cards; a
    // drafted digest is stored as the post_weekly_digest it lays out.
    const ownCards: string[] = [
      TRIAGE_TOOL,
      DELEGATE_TOOL,
      DIGEST_TOOL,
      THREAD_TICKET_TOOL,
      DECISION_TOOL,
    ];
    for (const name of CHAT_WRITE_TOOLS.filter((n) => !ownCards.includes(n))) {
      const definition = tools.definitions.find(
        (tool) => tool.function.name === name,
      );
      const properties = Object.keys(
        (definition?.function.parameters.properties ?? {}) as object,
      ).filter((key) => key !== "reason" && key !== "sources");
      expect(properties.length, name).toBeGreaterThan(0);
      for (const argument of properties) {
        expect(shownArguments(name), `${name}.${argument}`).toContain(argument);
      }
    }
  });

  it("shows the team, topic and position a write sets", () => {
    expect(
      fieldDiff(
        "create_task",
        { projectId: "p1", title: "New", topicId: "topic1" },
        null,
      ),
    ).toEqual([
      { field: "team", from: null, to: "p1" },
      { field: "title", from: null, to: "New" },
      { field: "topic", from: null, to: "topic1" },
    ]);
    expect(
      fieldDiff("update_task", { taskId: "t1", position: 3 }, task),
    ).toEqual([{ field: "position", from: null, to: "3" }]);
  });
});
