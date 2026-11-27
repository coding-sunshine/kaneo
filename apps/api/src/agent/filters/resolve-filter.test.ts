import { describe, expect, it } from "vite-plus/test";
import { readFilterAnswer, resolveFilter } from "./resolve-filter";

const lookup = {
  userId: "u-me",
  members: [
    { id: "u-me", name: "Sam Example" },
    { id: "u-2", name: "Alex Sample" },
  ],
  labels: [
    { id: "l-bug", name: "Bug" },
    { id: "l-bug-team", name: "bug" },
    { id: "l-ui", name: "UI" },
  ],
  columns: [
    { id: "to-do", name: "To Do" },
    { id: "in-progress", name: "In Progress" },
  ],
};

const empty = {
  question: null,
  assignee: [],
  labels: [],
  status: [],
  priority: [],
  blocked: false,
  createdOlderThanDays: null,
};

describe("resolveFilter", () => {
  it("turns 'my blocked bugs older than 2 weeks' into ids the board filters on", () => {
    expect(
      resolveFilter(
        {
          ...empty,
          assignee: ["me"],
          labels: ["bug"],
          blocked: true,
          createdOlderThanDays: 14,
        },
        lookup,
      ),
    ).toEqual({
      question: null,
      filters: {
        assignee: ["u-me"],
        labels: ["l-bug", "l-bug-team"],
        blocked: true,
        createdAt: ["olderThan:14"],
      },
    });
  });

  it("names statuses and people by their names", () => {
    expect(
      resolveFilter(
        {
          ...empty,
          assignee: ["alex sample"],
          status: ["in progress"],
          priority: ["high", "nonsense"],
        },
        lookup,
      ).filters,
    ).toEqual({
      assignee: ["u-2"],
      status: ["in-progress"],
      priority: ["high"],
    });
  });

  it("asks the model's one question and applies nothing", () => {
    expect(
      resolveFilter(
        { ...empty, labels: ["bug"], question: "Which team do you mean?" },
        lookup,
      ),
    ).toEqual({ filters: null, question: "Which team do you mean?" });
  });

  it("asks about a name it cannot find instead of guessing", () => {
    const result = resolveFilter({ ...empty, labels: ["frontend"] }, lookup);
    expect(result.filters).toBeNull();
    expect(result.question).toContain("frontend");
    const person = resolveFilter({ ...empty, assignee: ["Robin"] }, lookup);
    expect(person.filters).toBeNull();
    expect(person.question).toContain("Robin");
  });

  it("asks what to show when the sentence names no filter", () => {
    const result = resolveFilter(empty, lookup);
    expect(result.filters).toBeNull();
    expect(result.question).toBeTruthy();
  });
});

describe("readFilterAnswer", () => {
  it("reads JSON, also inside a code fence", () => {
    expect(
      readFilterAnswer('```json\n{"labels":["bug"],"blocked":true}\n```'),
    ).toMatchObject({ labels: ["bug"], blocked: true, assignee: [] });
  });

  it("is null for an answer that is not the filter shape", () => {
    expect(readFilterAnswer("Sure! Here are your bugs.")).toBeNull();
    expect(readFilterAnswer('{"createdOlderThanDays":-3}')).toBeNull();
  });
});
