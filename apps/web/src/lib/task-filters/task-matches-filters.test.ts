import { describe, expect, it } from "vite-plus/test";
import type { BoardFilters } from "@/hooks/use-task-filters";
import type Task from "@/types/task";
import {
  type TaskFilterContext,
  taskMatchesFilters,
} from "./task-matches-filters";

const noFilters: BoardFilters = {
  status: null,
  priority: null,
  assignee: null,
  dueDate: null,
  labels: null,
  customFields: null,
};

const context: TaskFilterContext = {
  projectSlug: "WEB",
  weekStartsOn: 1,
  today: new Date(2026, 9, 14),
  getCustomFieldValues: (taskId) =>
    taskId === "t1" ? [{ fieldId: "size", value: "L" }] : [],
};

function task(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    title: "Build pricing page",
    number: 18,
    description: "Plans and FAQ",
    status: "in-progress",
    priority: "high",
    dueDate: "2026-10-16",
    userId: "u1",
    labels: [{ id: "l1", name: "Engineering", color: "blue" }],
    ...overrides,
  } as Task;
}

describe("taskMatchesFilters", () => {
  it.each([
    ["pricing", true],
    ["faq", true],
    ["web-1", true],
    ["#18", true],
    ["18", true],
    ["#19", false],
    ["checkout", false],
  ])("matches the query %s: %s", (query, expected) => {
    expect(taskMatchesFilters(task({}), noFilters, { ...context, query })).toBe(
      expected,
    );
  });

  it("matches tasks the server found by description", () => {
    expect(
      taskMatchesFilters(task({ description: null }), noFilters, {
        ...context,
        query: "hidden",
        descriptionMatches: new Set(["t1"]),
      }),
    ).toBe(true);
  });

  it.each([
    [{ status: ["in-progress"] }, true],
    [{ status: ["done"] }, false],
    [{ priority: ["urgent", "high"] }, true],
    [{ priority: ["low"] }, false],
    [{ assignee: ["u1"] }, true],
    [{ assignee: ["u2"] }, false],
    [{ labels: ["l2", "l1"] }, true],
    [{ labels: ["l2"] }, false],
    [{ customFields: { size: ["L", "XL"] } }, true],
    [{ customFields: { size: ["S"] } }, false],
  ] as Array<[Partial<BoardFilters>, boolean]>)(
    "applies %o",
    (filters, expected) => {
      expect(
        taskMatchesFilters(task({}), { ...noFilters, ...filters }, context),
      ).toBe(expected);
    },
  );

  it.each([
    ["2026-10-16", ["dueThisWeek"], true],
    ["2026-10-21", ["dueThisWeek"], false],
    ["2026-10-21", ["dueNextWeek"], true],
    [null, ["noDueDate"], true],
    ["2026-10-16", ["noDueDate"], false],
    [null, ["dueThisWeek", "noDueDate"], true],
  ] as Array<[string | null, string[], boolean]>)(
    "treats due date %s against %o as %s",
    (dueDate, dueFilters, expected) => {
      expect(
        taskMatchesFilters(
          task({ dueDate }),
          { ...noFilters, dueDate: dueFilters },
          context,
        ),
      ).toBe(expected);
    },
  );

  it("requires a value for every filtered custom field", () => {
    expect(
      taskMatchesFilters(
        task({ id: "t2" }),
        { ...noFilters, customFields: { size: ["L"] } },
        context,
      ),
    ).toBe(false);
  });

  it.each([false, true])(
    "uses current label IDs with negation=%s",
    (negated) => {
      expect(
        taskMatchesFilters(
          task({}),
          {
            ...noFilters,
            labels: ["saved-label"],
            negated: negated ? ["labels"] : null,
          },
          { ...context, labelIds: new Set(["saved-label", "l1"]) },
        ),
      ).toBe(!negated);
    },
  );

  it.each([
    [{ priority: ["high"], negated: ["priority"] }, false],
    [{ priority: ["low"], negated: ["priority"] }, true],
    [{ labels: ["l1"], negated: ["labels"] }, false],
    [{ dueDate: ["noDueDate"], negated: ["dueDate"] }, true],
    [{ customFields: { size: ["S"] }, negated: ["customField:size"] }, true],
    [{ customFields: { size: ["L"] }, negated: ["customField:size"] }, false],
  ] as Array<[Partial<BoardFilters>, boolean]>)(
    "inverts negated subjects %o",
    (filters, expected) => {
      expect(
        taskMatchesFilters(task({}), { ...noFilters, ...filters }, context),
      ).toBe(expected);
    },
  );

  it("treats a missing custom field value as not matching a negated filter", () => {
    expect(
      taskMatchesFilters(
        task({ id: "t2" }),
        {
          ...noFilters,
          customFields: { size: ["L"] },
          negated: ["customField:size"],
        },
        context,
      ),
    ).toBe(true);
  });
});

describe.each(["startDate", "dueDate"] as const)(
  "custom %s filters",
  (field) => {
    it.each([
      ["exact:2026-10-15", "2026-10-15", true],
      ["exact:2026-10-15", "2026-10-15T23:59:59", true],
      ["exact:2026-10-15", "2026-10-16", false],
      ["range:2026-10-01:2026-10-15", "2026-10-01", true],
      ["range:2026-10-01:2026-10-15", "2026-10-15T23:59:59", true],
      ["range:2026-10-01:2026-10-15", "2026-09-30", false],
      ["range:2026-10-01:2026-10-15", "2026-10-16", false],
      ["before:2026-10-15", "2026-10-14", true],
      ["before:2026-10-15", "2026-10-15", false],
      ["after:2026-10-15", "2026-10-16", true],
      ["after:2026-10-15", "2026-10-15", false],
      ["exact:2026-10-15", null, false],
      ["after:2026-10-15", null, false],
      ["range:2026-10-15:2026-10-01", "2026-10-10", false],
    ])("%s against %s matches %s", (condition, date, expected) => {
      expect(
        taskMatchesFilters(
          task({ [field]: date }),
          { ...noFilters, [field]: [condition] },
          context,
        ),
      ).toBe(expected);
    });

    it("requires an explicit No date even for negative conditions", () => {
      const missing = task({ [field]: null });
      expect(
        taskMatchesFilters(
          missing,
          { ...noFilters, [field]: ["exact:2026-10-15"], negated: [field] },
          context,
        ),
      ).toBe(false);
      expect(
        taskMatchesFilters(
          missing,
          {
            ...noFilters,
            [field]: [field === "dueDate" ? "noDueDate" : "noDate"],
          },
          context,
        ),
      ).toBe(true);
    });
  },
);

it("combines both date fields with assignee, priority and labels", () => {
  const filters = {
    ...noFilters,
    startDate: ["range:2026-10-01:2026-10-15"],
    dueDate: ["exact:2026-10-16"],
    assignee: ["u1"],
    priority: ["high"],
    labels: ["l1"],
  };
  expect(
    taskMatchesFilters(task({ startDate: "2026-10-01" }), filters, context),
  ).toBe(true);
  expect(
    taskMatchesFilters(
      task({ startDate: "2026-10-01", userId: "u2" }),
      filters,
      context,
    ),
  ).toBe(false);
  expect(
    taskMatchesFilters(
      task({ startDate: "2026-10-01", dueDate: null }),
      filters,
      context,
    ),
  ).toBe(false);
});

it("filters by estimate, with none matching unestimated issues", () => {
  const filters = { ...noFilters, estimate: ["3", "none"] };
  expect(taskMatchesFilters(task({ estimate: 3 }), filters, context)).toBe(
    true,
  );
  expect(taskMatchesFilters(task({ estimate: null }), filters, context)).toBe(
    true,
  );
  expect(taskMatchesFilters(task({ estimate: 5 }), filters, context)).toBe(
    false,
  );
  expect(
    taskMatchesFilters(
      task({ estimate: 5 }),
      { ...filters, negated: ["estimate"] },
      context,
    ),
  ).toBe(true);
});

describe("match all / match any", () => {
  // The task is high priority but assigned to u1, not u2.
  const filters: BoardFilters = {
    ...noFilters,
    priority: ["high"],
    assignee: ["u2"],
  };

  it("matchAll (default) needs every active filter", () => {
    expect(taskMatchesFilters(task({}), filters, context)).toBe(false);
    expect(
      taskMatchesFilters(task({}), { ...filters, matchAny: false }, context),
    ).toBe(false);
  });

  it("matchAny needs one active filter", () => {
    const any = { ...filters, matchAny: true };
    expect(taskMatchesFilters(task({}), any, context)).toBe(true);
    expect(taskMatchesFilters(task({ priority: "low" }), any, context)).toBe(
      false,
    );
  });

  it("matchAny honours negation, custom fields and the text query", () => {
    const any: BoardFilters = {
      ...noFilters,
      matchAny: true,
      priority: ["low"],
      customFields: { size: ["L"] },
    };
    expect(taskMatchesFilters(task({}), any, context)).toBe(true);
    expect(
      taskMatchesFilters(
        task({}),
        { ...any, status: ["done"], negated: ["status"] },
        context,
      ),
    ).toBe(true);
    // The search box stays an AND on top of the filters.
    expect(
      taskMatchesFilters(task({}), any, { ...context, query: "nomatch" }),
    ).toBe(false);
  });

  it("matchAny with no active filters matches everything", () => {
    expect(
      taskMatchesFilters(task({}), { ...noFilters, matchAny: true }, context),
    ).toBe(true);
  });
});

describe("workable filter", () => {
  it("hides blocked tickets and keeps unblocked tickets", () => {
    const ticketA = task({ id: "A" });
    const ticketB = task({ id: "B" });
    const workableFilters: BoardFilters = { ...noFilters, workable: true };
    const withBlocker: TaskFilterContext = {
      ...context,
      blockedTaskIds: new Set(["B"]),
    };

    expect(taskMatchesFilters(ticketB, workableFilters, withBlocker)).toBe(
      false,
    );
    expect(taskMatchesFilters(ticketA, workableFilters, withBlocker)).toBe(
      true,
    );

    // Once A is closed, B is no longer in blockedTaskIds and reappears.
    const afterClose: TaskFilterContext = {
      ...context,
      blockedTaskIds: new Set(),
    };
    expect(taskMatchesFilters(ticketB, workableFilters, afterClose)).toBe(true);
  });

  it("supports matchAny and negation with workable", () => {
    const blockedHigh = task({ id: "B", priority: "high" });
    const blockedLow = task({ id: "B", priority: "low" });
    const withBlocker: TaskFilterContext = {
      ...context,
      blockedTaskIds: new Set(["B"]),
    };

    expect(
      taskMatchesFilters(
        blockedHigh,
        { ...noFilters, workable: true, priority: ["high"], matchAny: true },
        withBlocker,
      ),
    ).toBe(true);
    expect(
      taskMatchesFilters(
        blockedLow,
        { ...noFilters, workable: true, priority: ["high"], matchAny: true },
        withBlocker,
      ),
    ).toBe(false);
    expect(
      taskMatchesFilters(
        blockedHigh,
        { ...noFilters, workable: true, negated: ["workable"] },
        withBlocker,
      ),
    ).toBe(true);
  });
});
