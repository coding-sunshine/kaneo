import { describe, expect, it } from "vite-plus/test";
import type { BoardFilters } from "@/hooks/use-task-filters";
import type Task from "@/types/task";
import { applyParsedFilter } from "./apply-parsed-filter";
import { taskMatchesFilters } from "./task-matches-filters";

const today = new Date(2026, 10, 28);
const daysAgo = (days: number) =>
  new Date(today.getTime() - days * 86_400_000).toISOString();

const task = (id: string, overrides: Partial<Task>) =>
  ({
    id,
    title: id,
    status: "to-do",
    priority: "low",
    userId: "me",
    createdAt: daysAgo(30),
    labels: [{ id: "bug", name: "bug", color: "red" }],
    ...overrides,
  }) as Task;

const tasks = [
  task("match", {}),
  task("too-new", { createdAt: daysAgo(3) }),
  task("not-blocked", { id: "not-blocked" }),
  task("someone-else", { userId: "other" }),
  task("no-bug", { labels: [] }),
];
const blockedTaskIds = new Set(["match", "too-new", "someone-else", "no-bug"]);
const visible = (filters: BoardFilters) =>
  tasks
    .filter((item) =>
      taskMatchesFilters(item, filters, {
        today,
        weekStartsOn: 1,
        blockedTaskIds,
        getCustomFieldValues: () => [],
      }),
    )
    .map((item) => item.id);

describe("plain-English filters", () => {
  const parsed = {
    assignee: ["me"],
    labels: ["bug"],
    blocked: true as const,
    createdAt: ["olderThan:14"],
  };

  it("become the same board filter as one built by hand", () => {
    const byHand: BoardFilters = {
      status: null,
      priority: null,
      assignee: ["me"],
      dueDate: null,
      startDate: null,
      labels: ["bug"],
      workProject: null,
      cycle: null,
      estimate: null,
      statusAge: null,
      customFields: null,
      negated: null,
      blocked: true,
      createdAt: ["olderThan:14"],
    };
    expect(applyParsedFilter(parsed)).toEqual(byHand);
    expect(visible(applyParsedFilter(parsed))).toEqual(visible(byHand));
  });

  it("show my blocked bugs older than 2 weeks, and nothing else", () => {
    expect(visible(applyParsedFilter(parsed))).toEqual(["match"]);
  });
});
