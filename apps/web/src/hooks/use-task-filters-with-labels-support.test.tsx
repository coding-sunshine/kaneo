import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

const IGNORE_STATUS = ["status"] as const;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );

    const project = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [
        {
          id: "todo",
          slug: "todo",
          name: "Todo",
          icon: null,
          isFinal: false,
          tasks: [
            {
              id: "task-1",
              title: "Bug task",
              number: 1,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 0,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [
                {
                  id: "label-bug",
                  name: "bug",
                  color: "red",
                },
              ],
              externalLinks: [],
            },
            {
              id: "task-2",
              title: "Other task",
              number: 2,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 1,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [],
              externalLinks: [],
            },
          ],
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };

    const { result } = renderHook(
      () => useTaskFiltersWithLabelsSupport(project, "project-1"),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.filters.labels).toEqual(["label-bug"]);
    });

    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe(
      "task-1",
    );
  });

  it.each(["#123", "proj-123", "proj-"])(
    "matches a task by its issue identifier when searching for %s",
    (textQuery) => {
      const project = {
        id: "project-1",
        name: "Project",
        slug: "PROJ",
        icon: null,
        description: null,
        isPublic: false,
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
        workspaceId: "workspace-1",
        columns: [
          {
            id: "todo",
            slug: "todo",
            name: "Todo",
            icon: null,
            isFinal: false,
            tasks: [
              {
                id: "task-123",
                title: "Unrelated title",
                number: 123,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 0,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
              {
                id: "task-without-number",
                title: "Another unrelated title",
                number: null,
                description: null,
                status: "todo",
                priority: null,
                startDate: null,
                dueDate: null,
                position: 1,
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
                userId: null,
                assigneeId: null,
                assigneeName: null,
                assigneeImage: null,
                projectId: "project-1",
                labels: [],
                externalLinks: [],
              },
            ],
          },
        ],
        plannedTasks: [],
        archivedTasks: [],
      };

      const { result } = renderHook(
        () => useTaskFiltersWithLabelsSupport(project, "project-1", textQuery),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.filteredProject?.columns[0]?.tasks).toEqual([
        expect.objectContaining({ id: "task-123" }),
      ]);
    },
  );

  it("keeps an ignored status filter stored but out of the backlog", () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ status: ["done"], priority: ["high"] }),
    );
    const planned = {
      id: "planned-1",
      title: "Planned work",
      number: 7,
      description: null,
      status: "planned",
      priority: "high",
      dueDate: null,
      userId: null,
      labels: [],
    };
    const project = {
      id: "project-1",
      slug: "PROJ",
      columns: [],
      plannedTasks: [planned],
      archivedTasks: [],
    } as unknown as Parameters<typeof useTaskFiltersWithLabelsSupport>[0];

    const { result } = renderHook(
      () =>
        useTaskFiltersWithLabelsSupport(
          project,
          "project-1",
          "",
          undefined,
          IGNORE_STATUS,
        ),
      { wrapper: createWrapper() },
    );

    expect(result.current.filters.status).toBeNull();
    expect(result.current.activeFilterCount).toBe(1);
    expect(result.current.filteredProject?.plannedTasks).toHaveLength(1);

    act(() => result.current.clearFilters());

    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual(
      expect.objectContaining({ status: ["done"], priority: null }),
    );
  });
});

it("uses the project subtask default, persists an override, and follows live membership changes", () => {
  window.localStorage.clear();
  const parent = { id: "parent", title: "Parent" } as Task;
  const child = { id: "child", title: "Child", isSubtask: true } as Task;
  const project = {
    id: "subtask-project",
    includeSubtasks: false,
    columns: [{ id: "todo", tasks: [parent, child] }],
    plannedTasks: [child],
    archivedTasks: [child],
  } as unknown as ProjectWithTasks;
  const { result, rerender, unmount } = renderHook(
    ({ project }) => useTaskFiltersWithLabelsSupport(project, project.id),
    { initialProps: { project }, wrapper: createWrapper() },
  );
  expect(result.current.filteredProject?.columns[0].tasks).toEqual([parent]);
  expect(result.current.filteredProject?.plannedTasks).toEqual([]);
  expect(result.current.filteredProject?.archivedTasks).toEqual([]);
  expect(result.current.filterTasks([parent, child])).toEqual([parent]);
  act(() => result.current.setIncludeSubtasks(true));
  expect(result.current.filterTasks([parent, child])).toEqual([parent, child]);
  expect(
    JSON.parse(
      window.localStorage.getItem("kaneo:include-subtasks:subtask-project")!,
    ),
  ).toBe(true);
  act(() => result.current.setIncludeSubtasks(false));
  rerender({
    project: {
      ...project,
      columns: [
        {
          ...project.columns[0],
          tasks: [parent, { ...child, isSubtask: false }],
        },
      ],
    },
  });
  expect(result.current.filteredProject?.columns[0].tasks).toHaveLength(2);
  unmount();
  window.localStorage.clear();
});

it("clears a legacy subtask override and follows changing project defaults after remount", () => {
  window.localStorage.clear();
  const key = "kaneo:include-subtasks:project-default";
  window.localStorage.setItem(key, "true");
  const project = {
    id: "project-default",
    includeSubtasks: false,
    columns: [],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  const { result, rerender, unmount } = renderHook(
    ({ project }) => useTaskFiltersWithLabelsSupport(project, project.id),
    { initialProps: { project }, wrapper: createWrapper() },
  );
  expect(result.current.includeSubtasks).toBe(true);
  expect(result.current.hasIncludeSubtasksOverride).toBe(true);
  act(() => result.current.setIncludeSubtasks(null));
  expect(result.current.includeSubtasks).toBe(false);
  expect(result.current.hasIncludeSubtasksOverride).toBe(false);
  expect(JSON.parse(window.localStorage.getItem(key)!)).toBeNull();
  rerender({ project: { ...project, includeSubtasks: true } });
  expect(result.current.includeSubtasks).toBe(true);
  rerender({ project: { ...project, includeSubtasks: false } });
  expect(result.current.includeSubtasks).toBe(false);
  unmount();
  const restored = renderHook(
    () => useTaskFiltersWithLabelsSupport(project, project.id),
    { wrapper: createWrapper() },
  );
  expect(restored.result.current.hasIncludeSubtasksOverride).toBe(false);
  expect(restored.result.current.includeSubtasks).toBe(false);
  act(() => restored.result.current.setIncludeSubtasks(true));
  expect(restored.result.current.hasIncludeSubtasksOverride).toBe(true);
  restored.unmount();
  window.localStorage.clear();
});

it("restores, updates, and clears date conditions with other saved filters", async () => {
  const key = "kaneo:board-filters:date-test";
  window.localStorage.setItem(
    key,
    JSON.stringify({
      startDate: ["range:2026-10-01:2026-10-15"],
      dueDate: ["dueThisWeek"],
      priority: ["high"],
    }),
  );
  const { result, unmount } = renderHook(
    () => useTaskFiltersWithLabelsSupport(null, "date-test"),
    { wrapper: createWrapper() },
  );
  await waitFor(() =>
    expect(result.current.filters.startDate).toEqual([
      "range:2026-10-01:2026-10-15",
    ]),
  );
  expect(result.current.activeFilterCount).toBe(3);
  act(() => result.current.updateFilter("dueDate", ["exact:2026-10-15"]));
  await waitFor(() =>
    expect(JSON.parse(window.localStorage.getItem(key)!).dueDate).toEqual([
      "exact:2026-10-15",
    ]),
  );
  act(() => result.current.clearFilters());
  expect(result.current.activeFilterCount).toBe(0);
  expect(result.current.filters.startDate).toBeNull();
  unmount();
  window.localStorage.removeItem(key);
});

it("hides blocked tickets when workable is enabled and restores them once the blocker closes", () => {
  window.localStorage.clear();
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    ["task-relations", "project", "workable-project"],
    [
      {
        id: "rel-1",
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "blocks",
        createdAt: "2026-04-16T00:00:00.000Z",
      },
    ],
  );

  const taskA = { id: "task-a", title: "Ticket A", status: "to-do" } as Task;
  const taskB = { id: "task-b", title: "Ticket B", status: "to-do" } as Task;
  const openProject = {
    id: "workable-project",
    columns: [
      { id: "to-do", slug: "to-do", isFinal: false, tasks: [taskA, taskB] },
      { id: "done", slug: "done", isFinal: true, tasks: [] },
    ],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result, rerender, unmount } = renderHook(
    ({ project }) =>
      useTaskFiltersWithLabelsSupport(project, "workable-project"),
    { initialProps: { project: openProject }, wrapper },
  );

  expect(
    result.current.filteredProject?.columns[0]?.tasks.map((t) => t.id),
  ).toEqual(["task-a", "task-b"]);

  act(() => result.current.updateFilter("workable", true));

  expect(result.current.activeFilterCount).toBe(1);
  expect(
    result.current.filteredProject?.columns[0]?.tasks.map((t) => t.id),
  ).toEqual(["task-a"]);

  // Close ticket A by moving it to the final Done column -> ticket B reappears.
  const closedAProject = {
    ...openProject,
    columns: [
      { id: "to-do", slug: "to-do", isFinal: false, tasks: [taskB] },
      {
        id: "done",
        slug: "done",
        isFinal: true,
        tasks: [{ ...taskA, status: "done" }],
      },
    ],
  } as unknown as ProjectWithTasks;

  rerender({ project: closedAProject });

  expect(
    result.current.filteredProject?.columns[0]?.tasks.map((t) => t.id),
  ).toEqual(["task-b"]);

  unmount();
  window.localStorage.clear();
});
